function safeCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function typeIs(type) {
  return function(any) {
    return typeof any === type;
  };
}

function Predicate(func, ...args) {
  console.assert(typeof func === 'function');
  const applied = func.apply(this, args);
  this.test = typeof applied === 'function' ? applied : func;
  this.name = func.name;
  this.args = args;
}

const isFunc = typeIs('function');
const isString = typeIs('string');
const isBoolean = typeIs('boolean');
const isNumber = typeIs('number');

function isEqual(anyArg) {
  var f = function(any) {
    return any === anyArg;
  };
  f.funcInfo = {
    funcName: "isEqual",
    arg: anyArg
  };
  return f;
}


function not(func) {
  return function(any) {
    return !func(any);
  };
}

function or(...rawArgs) {
  var functions = rawArgs.map(function(arg) {
    if (isFunc(arg)) {
      return arg;
    }
    else {
      return createValidator(arg);
    }
  });
  return function(any) {
    return functions.some(function(func) {
      return func(any);
    });
  };
}

function isTruthy(any) {
  return !!(any);
}

function alwaysTrue() {
  return function(any) {
    return true;
  };
}

function nullable(anyArg) {
  if (anyArg === null) {
    return isEqual(null);
  }
  else {
    return or(null, anyArg);
  }
}

function testRegex(regex) {
  console.assert(regex instanceof RegExp);
  return function(any) {
    return isString(any) && regex.test(any);
  };
}

function isArray(func) {
  if (isFunc(func)) {
    return function(any) {
      if (Array.isArray(any)) {
        var reduceResult = any.reduce(function(result, partialValue) {
          var partialResult = func(partialValue);
          if (partialResult === false) {
            result.push(safeCopy({
              cause: 'isArray/funcFailed',
              value: partialValue,
              func: String(func)
            }));
            if (func.funcInfo) {
              console.log(func.funcInfo);
            }
          }
          else if (partialResult !== true) {
            result = result.concat(partialResult);
          }
          return result;
        }, []);
        return reduceResult.length === 0 || reduceResult;
      }
      else {
        return safeCopy({
          cause: 'isArray', //TBD
          value: any
        });
      }
    };
  }
  else {
    return function(any) {
      return Array.isArray(any) || safeCopy({
        cause: 'isArray', //TBD
        value: any
      });
    };
  }
}

function funcEvery(funcArray) {
  console.assert(isArray(isFunc)(funcArray), 'funcEvery requires function array.');
  return function(any) {
    return funcArray.every(function(func) {
      return func(any);
    });
  };
}

function objectHasKey(keyArg) {
  if (isString(keyArg)) {
    return function(any) {
      return (_isObject(any) && (keyArg in any || safeCopy({
        cause: 'objectHasKey',
        key: keyArg,
        object: any
      }))) || safeCopy({
        cause: 'objectHasKey/isObject',
        value: any
      })
    };
  }
  else if (isArray(isString)(keyArg)) {
    return function(any) {
      if (_isObject(any)) {
        var notInKeys = keyArg.filter(function(key) {
          return !(key in any);
        });
        return notInKeys.length === 0 || safeCopy({
          cause: 'objectHasKey/notInKeys',
          keys: notInKeys,
          object: any
        })
      }
      else {
        return safeCopy({
          cause: 'objectHasKey/isObject',
          value: any
        });
      }
    };
  }
  else {
    throw new Exception('objectHasKey argument must be string or string array.');
  }
}

const _isObject = funcEvery([isTruthy, typeIs('object'), not(Array.isArray)]);

function objectValueIs(objArg) {
  console.assert(_isObject(objArg), 'objectValueIs requires funcion value object');
  const keys = Object.keys(objArg);
  return function(any) {
    var result = [];
    var objectHasKeyResult = objectHasKey(keys)(any);
    if (objectHasKeyResult !== true) {
      result.push(objectHasKeyResult);
    }
    if (_isObject(any)) {
      keys.forEach(function(key) {
        if (!(key in any)) {
          return;
        }
        var partialResult = objArg[key](any[key]);
        if (partialResult === false) {
          result.push(safeCopy({
            cause: 'objectValueIs/funcFailed',
            key,
            value: any[key],
            func: String(objArg[key]),
            parent: any
          }));
          if (objArg[key].funcInfo) {
            //console.log(objArg[key].funcInfo);
          }
        }
        else if (partialResult !== true) {
          result = result.concat(partialResult);
        }
      });
    }
    return result.length === 0 || result;
  };
}


function createValidator(any) {
  if (any === null) {
    return isEqual(null);
  }
  if (any instanceof RegExp) {
    return testRegex(any);
  }
  else if (_isObject(any)) {
    if (Object.keys(any).length === 0) {
      return _isObject;
    }
    else {
      return objectValueIsParser(any);
    }
  }
  else if (isString(any)) {
    if (any === '*') {
      return alwaysTrue;
    }
    else {
      return isEqual(any);
    }
  }
  else if (isNumber(any)) {
    return isEqual(any);
  }
  else if (isBoolean(any)) {
    return isEqual(any);
  }
  else if (isFunc(any)) {
    return any;
  }
  else if (isArray(any)) {
    return isArrayParser(any);
  }
  else {
    return any;
  }
}

function objectValueIsParser(objArg) {
  console.assert(_isObject(objArg));
  return objectValueIs(Object.keys(objArg).reduce(function(result, key) {
    result[key] = createValidator(objArg[key]);
    return result;
  }, {}));
}

function isArrayParser(arrayArg) {
  console.assert(isArray(arrayArg));
  if (arrayArg.length > 0) {
    return isArray(createValidator(arrayArg[0]));
  }
  else {
    return new Predicate(Array.isArray);
  }
}


module.exports = {
  createValidator,
  isString,
  isNumber,
  nullable,
  or
};
