if(!Function.prototype.bind) {
  Function.prototype.bind = function(scope){
    var self = this;
    return function(){
      return self.apply(scope, arguments);
    };
  }
}
