RAML.Inspector = (function() {
  'use strict';

  function Clone() {}
  var exports = {};

  var METHOD_ORDERING = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'];

  // 1) copy common properties and new properties from the new object to the existing object
  // 2) remove properties from the existing
  function mergeObjects(source, target) {
    var targetKeys = Object.keys(target),
        sourceKeys = Object.keys(source);

    var removedKeys = targetKeys.filter(function(targetKey) {
      return !sourceKeys.some(function(sourceKey) {
        return sourceKey === targetKey;
      });
    });

    removedKeys.forEach(function(key) {
      delete target[key];
    });

    sourceKeys.forEach(function(key) {
      var sourceValue = source[key];
      var targetValue = target[key];
      var sourceValueMissing = sourceValue === null || sourceValue === undefined;
      var targetValueMissing = targetValue === null || targetValue === undefined;
      var sourceValueIsNotObject = typeof sourceValue !== 'object';


      if (sourceValueIsNotObject || sourceValueMissing || targetValueMissing) {
        target[key] = sourceValue;
      } else {
        mergeObjects(sourceValue, targetValue);
      }
    });
  }

  function extendMethod(method, securitySchemes) {
    securitySchemes = securitySchemes || [];

    method.securitySchemes = function() {
      var securedBy, selectedSchemes = {};
      securedBy = (this.securedBy || []).filter(function(name) {
        return name !== null && typeof name !== 'object';
      });

      securitySchemes.forEach(function(scheme) {
        securedBy.forEach(function(name) {
          if (scheme[name]) {
            selectedSchemes[name] = scheme[name];
          }
        });
      });

      return selectedSchemes;
    };

    method.allowsAnonymousAccess = function() {
      return (this.securedBy || []).some(function(name) { return name === null; });
    };
  }

  function extractResources(basePathSegments, api, securitySchemes) {
    var resources = [], apiResources = api.resources || [];

    apiResources.forEach(function(resource) {
      var resourcePathSegments = basePathSegments.concat(RAML.Client.createPathSegment(resource));
      var overview = exports.resourceOverviewSource(resourcePathSegments, resource);

      overview.methods.forEach(function(method) {
        extendMethod(method, securitySchemes);
      });

      resources.push(overview);

      if (resource.resources) {
        var extracted = extractResources(resourcePathSegments, resource, securitySchemes);
        extracted.forEach(function(resource) {
          resources.push(resource);
        });
      }
    });

    return resources;
  }

  function groupResources(resources) {
    var currentPrefix, resourceGroups = [];

    (resources || []).forEach(function(resource) {
      if (resource.pathSegments[0].toString().indexOf(currentPrefix) !== 0) {
        currentPrefix = resource.pathSegments[0].toString();
        resourceGroups.push([]);
      }
      resourceGroups[resourceGroups.length-1].push(resource);
    });

    return resourceGroups;
  }

  exports.resourceOverviewSource = function(pathSegments, resource) {
    Clone.prototype = resource;
    var clone = new Clone();

    clone.traits = resource.is;
    clone.resourceType = resource.type;
    clone.type = clone.is = undefined;
    clone.pathSegments = pathSegments;

    clone.methods = (resource.methods || []);

    clone.methods.sort(function(a, b) {
      var aOrder = METHOD_ORDERING.indexOf(a.method.toUpperCase());
      var bOrder = METHOD_ORDERING.indexOf(b.method.toUpperCase());

      return aOrder > bOrder ? 1 : -1;
    });

    return clone;
  };

  exports.create = function(api) {
    if (api.baseUri) {
      api.baseUri = RAML.Client.createBaseUri(api);
    }

    api.resources = extractResources([], api, api.securitySchemes);
    api.resourceGroups = groupResources(api.resources);

    return api;
  };

  exports.merge = function(source, target) {
    mergeObjects(source, target);
  };

  return exports;
})();
