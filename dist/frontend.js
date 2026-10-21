var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  if (mod && typeof mod === "object" || typeof mod === "function") {
    for (let key of __getOwnPropNames(mod))
      if (!__hasOwnProp.call(to, key))
        __defProp(to, key, {
          get: __accessProp.bind(mod, key),
          enumerable: true
        });
  }
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);

// node_modules/jquery/dist/jquery.js
var require_jquery = __commonJS(function(exports, module) {
  /*!
   * jQuery JavaScript Library v3.7.1
   * https://jquery.com/
   *
   * Copyright OpenJS Foundation and other contributors
   * Released under the MIT license
   * https://jquery.org/license
   *
   * Date: 2023-08-28T13:37Z
   */
  (function(global, factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
      module.exports = global.document ? factory(global, true) : function(w) {
        if (!w.document) {
          throw new Error("jQuery requires a window with a document");
        }
        return factory(w);
      };
    } else {
      factory(global);
    }
  })(typeof window !== "undefined" ? window : exports, function(window2, noGlobal) {
    var arr = [];
    var getProto = Object.getPrototypeOf;
    var slice = arr.slice;
    var flat = arr.flat ? function(array) {
      return arr.flat.call(array);
    } : function(array) {
      return arr.concat.apply([], array);
    };
    var push = arr.push;
    var indexOf = arr.indexOf;
    var class2type = {};
    var toString = class2type.toString;
    var hasOwn = class2type.hasOwnProperty;
    var fnToString = hasOwn.toString;
    var ObjectFunctionString = fnToString.call(Object);
    var support = {};
    var isFunction = function isFunction(obj) {
      return typeof obj === "function" && typeof obj.nodeType !== "number" && typeof obj.item !== "function";
    };
    var isWindow = function isWindow(obj) {
      return obj != null && obj === obj.window;
    };
    var document2 = window2.document;
    var preservedScriptAttributes = {
      type: true,
      src: true,
      nonce: true,
      noModule: true
    };
    function DOMEval(code, node, doc) {
      doc = doc || document2;
      var i, val, script = doc.createElement("script");
      script.text = code;
      if (node) {
        for (i in preservedScriptAttributes) {
          val = node[i] || node.getAttribute && node.getAttribute(i);
          if (val) {
            script.setAttribute(i, val);
          }
        }
      }
      doc.head.appendChild(script).parentNode.removeChild(script);
    }
    function toType(obj) {
      if (obj == null) {
        return obj + "";
      }
      return typeof obj === "object" || typeof obj === "function" ? class2type[toString.call(obj)] || "object" : typeof obj;
    }
    var version = "3.7.1", rhtmlSuffix = /HTML$/i, jQuery = function(selector, context) {
      return new jQuery.fn.init(selector, context);
    };
    jQuery.fn = jQuery.prototype = {
      jquery: version,
      constructor: jQuery,
      length: 0,
      toArray: function() {
        return slice.call(this);
      },
      get: function(num) {
        if (num == null) {
          return slice.call(this);
        }
        return num < 0 ? this[num + this.length] : this[num];
      },
      pushStack: function(elems) {
        var ret = jQuery.merge(this.constructor(), elems);
        ret.prevObject = this;
        return ret;
      },
      each: function(callback) {
        return jQuery.each(this, callback);
      },
      map: function(callback) {
        return this.pushStack(jQuery.map(this, function(elem, i) {
          return callback.call(elem, i, elem);
        }));
      },
      slice: function() {
        return this.pushStack(slice.apply(this, arguments));
      },
      first: function() {
        return this.eq(0);
      },
      last: function() {
        return this.eq(-1);
      },
      even: function() {
        return this.pushStack(jQuery.grep(this, function(_elem, i) {
          return (i + 1) % 2;
        }));
      },
      odd: function() {
        return this.pushStack(jQuery.grep(this, function(_elem, i) {
          return i % 2;
        }));
      },
      eq: function(i) {
        var len = this.length, j = +i + (i < 0 ? len : 0);
        return this.pushStack(j >= 0 && j < len ? [this[j]] : []);
      },
      end: function() {
        return this.prevObject || this.constructor();
      },
      push,
      sort: arr.sort,
      splice: arr.splice
    };
    jQuery.extend = jQuery.fn.extend = function() {
      var options, name, src, copy, copyIsArray, clone, target = arguments[0] || {}, i = 1, length = arguments.length, deep = false;
      if (typeof target === "boolean") {
        deep = target;
        target = arguments[i] || {};
        i++;
      }
      if (typeof target !== "object" && !isFunction(target)) {
        target = {};
      }
      if (i === length) {
        target = this;
        i--;
      }
      for (;i < length; i++) {
        if ((options = arguments[i]) != null) {
          for (name in options) {
            copy = options[name];
            if (name === "__proto__" || target === copy) {
              continue;
            }
            if (deep && copy && (jQuery.isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {
              src = target[name];
              if (copyIsArray && !Array.isArray(src)) {
                clone = [];
              } else if (!copyIsArray && !jQuery.isPlainObject(src)) {
                clone = {};
              } else {
                clone = src;
              }
              copyIsArray = false;
              target[name] = jQuery.extend(deep, clone, copy);
            } else if (copy !== undefined) {
              target[name] = copy;
            }
          }
        }
      }
      return target;
    };
    jQuery.extend({
      expando: "jQuery" + (version + Math.random()).replace(/\D/g, ""),
      isReady: true,
      error: function(msg) {
        throw new Error(msg);
      },
      noop: function() {},
      isPlainObject: function(obj) {
        var proto, Ctor;
        if (!obj || toString.call(obj) !== "[object Object]") {
          return false;
        }
        proto = getProto(obj);
        if (!proto) {
          return true;
        }
        Ctor = hasOwn.call(proto, "constructor") && proto.constructor;
        return typeof Ctor === "function" && fnToString.call(Ctor) === ObjectFunctionString;
      },
      isEmptyObject: function(obj) {
        var name;
        for (name in obj) {
          return false;
        }
        return true;
      },
      globalEval: function(code, options, doc) {
        DOMEval(code, { nonce: options && options.nonce }, doc);
      },
      each: function(obj, callback) {
        var length, i = 0;
        if (isArrayLike(obj)) {
          length = obj.length;
          for (;i < length; i++) {
            if (callback.call(obj[i], i, obj[i]) === false) {
              break;
            }
          }
        } else {
          for (i in obj) {
            if (callback.call(obj[i], i, obj[i]) === false) {
              break;
            }
          }
        }
        return obj;
      },
      text: function(elem) {
        var node, ret = "", i = 0, nodeType = elem.nodeType;
        if (!nodeType) {
          while (node = elem[i++]) {
            ret += jQuery.text(node);
          }
        }
        if (nodeType === 1 || nodeType === 11) {
          return elem.textContent;
        }
        if (nodeType === 9) {
          return elem.documentElement.textContent;
        }
        if (nodeType === 3 || nodeType === 4) {
          return elem.nodeValue;
        }
        return ret;
      },
      makeArray: function(arr, results) {
        var ret = results || [];
        if (arr != null) {
          if (isArrayLike(Object(arr))) {
            jQuery.merge(ret, typeof arr === "string" ? [arr] : arr);
          } else {
            push.call(ret, arr);
          }
        }
        return ret;
      },
      inArray: function(elem, arr, i) {
        return arr == null ? -1 : indexOf.call(arr, elem, i);
      },
      isXMLDoc: function(elem) {
        var namespace = elem && elem.namespaceURI, docElem = elem && (elem.ownerDocument || elem).documentElement;
        return !rhtmlSuffix.test(namespace || docElem && docElem.nodeName || "HTML");
      },
      merge: function(first, second) {
        var len = +second.length, j = 0, i = first.length;
        for (;j < len; j++) {
          first[i++] = second[j];
        }
        first.length = i;
        return first;
      },
      grep: function(elems, callback, invert) {
        var callbackInverse, matches = [], i = 0, length = elems.length, callbackExpect = !invert;
        for (;i < length; i++) {
          callbackInverse = !callback(elems[i], i);
          if (callbackInverse !== callbackExpect) {
            matches.push(elems[i]);
          }
        }
        return matches;
      },
      map: function(elems, callback, arg) {
        var length, value, i = 0, ret = [];
        if (isArrayLike(elems)) {
          length = elems.length;
          for (;i < length; i++) {
            value = callback(elems[i], i, arg);
            if (value != null) {
              ret.push(value);
            }
          }
        } else {
          for (i in elems) {
            value = callback(elems[i], i, arg);
            if (value != null) {
              ret.push(value);
            }
          }
        }
        return flat(ret);
      },
      guid: 1,
      support
    });
    if (typeof Symbol === "function") {
      jQuery.fn[Symbol.iterator] = arr[Symbol.iterator];
    }
    jQuery.each("Boolean Number String Function Array Date RegExp Object Error Symbol".split(" "), function(_i, name) {
      class2type["[object " + name + "]"] = name.toLowerCase();
    });
    function isArrayLike(obj) {
      var length = !!obj && "length" in obj && obj.length, type = toType(obj);
      if (isFunction(obj) || isWindow(obj)) {
        return false;
      }
      return type === "array" || length === 0 || typeof length === "number" && length > 0 && length - 1 in obj;
    }
    function nodeName(elem, name) {
      return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();
    }
    var pop = arr.pop;
    var sort = arr.sort;
    var splice = arr.splice;
    var whitespace = "[\\x20\\t\\r\\n\\f]";
    var rtrimCSS = new RegExp("^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$", "g");
    jQuery.contains = function(a, b) {
      var bup = b && b.parentNode;
      return a === bup || !!(bup && bup.nodeType === 1 && (a.contains ? a.contains(bup) : a.compareDocumentPosition && a.compareDocumentPosition(bup) & 16));
    };
    var rcssescape = /([\0-\x1f\x7f]|^-?\d)|^-$|[^\x80-\uFFFF\w-]/g;
    function fcssescape(ch, asCodePoint) {
      if (asCodePoint) {
        if (ch === "\x00") {
          return "�";
        }
        return ch.slice(0, -1) + "\\" + ch.charCodeAt(ch.length - 1).toString(16) + " ";
      }
      return "\\" + ch;
    }
    jQuery.escapeSelector = function(sel) {
      return (sel + "").replace(rcssescape, fcssescape);
    };
    var preferredDoc = document2, pushNative = push;
    (function() {
      var i, Expr, outermostContext, sortInput, hasDuplicate, push = pushNative, document2, documentElement, documentIsHTML, rbuggyQSA, matches, expando = jQuery.expando, dirruns = 0, done = 0, classCache = createCache(), tokenCache = createCache(), compilerCache = createCache(), nonnativeSelectorCache = createCache(), sortOrder = function(a, b) {
        if (a === b) {
          hasDuplicate = true;
        }
        return 0;
      }, booleans = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|" + "loop|multiple|open|readonly|required|scoped", identifier = "(?:\\\\[\\da-fA-F]{1,6}" + whitespace + "?|\\\\[^\\r\\n\\f]|[\\w-]|[^\x00-\\x7f])+", attributes = "\\[" + whitespace + "*(" + identifier + ")(?:" + whitespace + "*([*^$|!~]?=)" + whitespace + `*(?:'((?:\\\\.|[^\\\\'])*)'|"((?:\\\\.|[^\\\\"])*)"|(` + identifier + "))|)" + whitespace + "*\\]", pseudos = ":(" + identifier + ")(?:\\((" + `('((?:\\\\.|[^\\\\'])*)'|"((?:\\\\.|[^\\\\"])*)")|` + "((?:\\\\.|[^\\\\()[\\]]|" + attributes + ")*)|" + ".*" + ")\\)|)", rwhitespace = new RegExp(whitespace + "+", "g"), rcomma = new RegExp("^" + whitespace + "*," + whitespace + "*"), rleadingCombinator = new RegExp("^" + whitespace + "*([>+~]|" + whitespace + ")" + whitespace + "*"), rdescend = new RegExp(whitespace + "|>"), rpseudo = new RegExp(pseudos), ridentifier = new RegExp("^" + identifier + "$"), matchExpr = {
        ID: new RegExp("^#(" + identifier + ")"),
        CLASS: new RegExp("^\\.(" + identifier + ")"),
        TAG: new RegExp("^(" + identifier + "|[*])"),
        ATTR: new RegExp("^" + attributes),
        PSEUDO: new RegExp("^" + pseudos),
        CHILD: new RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" + whitespace + "*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" + whitespace + "*(\\d+)|))" + whitespace + "*\\)|)", "i"),
        bool: new RegExp("^(?:" + booleans + ")$", "i"),
        needsContext: new RegExp("^" + whitespace + "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" + whitespace + "*((?:-\\d)?\\d*)" + whitespace + "*\\)|)(?=[^-]|$)", "i")
      }, rinputs = /^(?:input|select|textarea|button)$/i, rheader = /^h\d$/i, rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/, rsibling = /[+~]/, runescape = new RegExp("\\\\[\\da-fA-F]{1,6}" + whitespace + "?|\\\\([^\\r\\n\\f])", "g"), funescape = function(escape, nonHex) {
        var high = "0x" + escape.slice(1) - 65536;
        if (nonHex) {
          return nonHex;
        }
        return high < 0 ? String.fromCharCode(high + 65536) : String.fromCharCode(high >> 10 | 55296, high & 1023 | 56320);
      }, unloadHandler = function() {
        setDocument();
      }, inDisabledFieldset = addCombinator(function(elem) {
        return elem.disabled === true && nodeName(elem, "fieldset");
      }, { dir: "parentNode", next: "legend" });
      function safeActiveElement() {
        try {
          return document2.activeElement;
        } catch (err) {}
      }
      try {
        push.apply(arr = slice.call(preferredDoc.childNodes), preferredDoc.childNodes);
        arr[preferredDoc.childNodes.length].nodeType;
      } catch (e) {
        push = {
          apply: function(target, els) {
            pushNative.apply(target, slice.call(els));
          },
          call: function(target) {
            pushNative.apply(target, slice.call(arguments, 1));
          }
        };
      }
      function find(selector, context, results, seed) {
        var m, i, elem, nid, match, groups, newSelector, newContext = context && context.ownerDocument, nodeType = context ? context.nodeType : 9;
        results = results || [];
        if (typeof selector !== "string" || !selector || nodeType !== 1 && nodeType !== 9 && nodeType !== 11) {
          return results;
        }
        if (!seed) {
          setDocument(context);
          context = context || document2;
          if (documentIsHTML) {
            if (nodeType !== 11 && (match = rquickExpr.exec(selector))) {
              if (m = match[1]) {
                if (nodeType === 9) {
                  if (elem = context.getElementById(m)) {
                    if (elem.id === m) {
                      push.call(results, elem);
                      return results;
                    }
                  } else {
                    return results;
                  }
                } else {
                  if (newContext && (elem = newContext.getElementById(m)) && find.contains(context, elem) && elem.id === m) {
                    push.call(results, elem);
                    return results;
                  }
                }
              } else if (match[2]) {
                push.apply(results, context.getElementsByTagName(selector));
                return results;
              } else if ((m = match[3]) && context.getElementsByClassName) {
                push.apply(results, context.getElementsByClassName(m));
                return results;
              }
            }
            if (!nonnativeSelectorCache[selector + " "] && (!rbuggyQSA || !rbuggyQSA.test(selector))) {
              newSelector = selector;
              newContext = context;
              if (nodeType === 1 && (rdescend.test(selector) || rleadingCombinator.test(selector))) {
                newContext = rsibling.test(selector) && testContext(context.parentNode) || context;
                if (newContext != context || !support.scope) {
                  if (nid = context.getAttribute("id")) {
                    nid = jQuery.escapeSelector(nid);
                  } else {
                    context.setAttribute("id", nid = expando);
                  }
                }
                groups = tokenize(selector);
                i = groups.length;
                while (i--) {
                  groups[i] = (nid ? "#" + nid : ":scope") + " " + toSelector(groups[i]);
                }
                newSelector = groups.join(",");
              }
              try {
                push.apply(results, newContext.querySelectorAll(newSelector));
                return results;
              } catch (qsaError) {
                nonnativeSelectorCache(selector, true);
              } finally {
                if (nid === expando) {
                  context.removeAttribute("id");
                }
              }
            }
          }
        }
        return select(selector.replace(rtrimCSS, "$1"), context, results, seed);
      }
      function createCache() {
        var keys = [];
        function cache(key, value) {
          if (keys.push(key + " ") > Expr.cacheLength) {
            delete cache[keys.shift()];
          }
          return cache[key + " "] = value;
        }
        return cache;
      }
      function markFunction(fn) {
        fn[expando] = true;
        return fn;
      }
      function assert(fn) {
        var el = document2.createElement("fieldset");
        try {
          return !!fn(el);
        } catch (e) {
          return false;
        } finally {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
          el = null;
        }
      }
      function createInputPseudo(type) {
        return function(elem) {
          return nodeName(elem, "input") && elem.type === type;
        };
      }
      function createButtonPseudo(type) {
        return function(elem) {
          return (nodeName(elem, "input") || nodeName(elem, "button")) && elem.type === type;
        };
      }
      function createDisabledPseudo(disabled) {
        return function(elem) {
          if ("form" in elem) {
            if (elem.parentNode && elem.disabled === false) {
              if ("label" in elem) {
                if ("label" in elem.parentNode) {
                  return elem.parentNode.disabled === disabled;
                } else {
                  return elem.disabled === disabled;
                }
              }
              return elem.isDisabled === disabled || elem.isDisabled !== !disabled && inDisabledFieldset(elem) === disabled;
            }
            return elem.disabled === disabled;
          } else if ("label" in elem) {
            return elem.disabled === disabled;
          }
          return false;
        };
      }
      function createPositionalPseudo(fn) {
        return markFunction(function(argument) {
          argument = +argument;
          return markFunction(function(seed, matches) {
            var j, matchIndexes = fn([], seed.length, argument), i = matchIndexes.length;
            while (i--) {
              if (seed[j = matchIndexes[i]]) {
                seed[j] = !(matches[j] = seed[j]);
              }
            }
          });
        });
      }
      function testContext(context) {
        return context && typeof context.getElementsByTagName !== "undefined" && context;
      }
      function setDocument(node) {
        var subWindow, doc = node ? node.ownerDocument || node : preferredDoc;
        if (doc == document2 || doc.nodeType !== 9 || !doc.documentElement) {
          return document2;
        }
        document2 = doc;
        documentElement = document2.documentElement;
        documentIsHTML = !jQuery.isXMLDoc(document2);
        matches = documentElement.matches || documentElement.webkitMatchesSelector || documentElement.msMatchesSelector;
        if (documentElement.msMatchesSelector && preferredDoc != document2 && (subWindow = document2.defaultView) && subWindow.top !== subWindow) {
          subWindow.addEventListener("unload", unloadHandler);
        }
        support.getById = assert(function(el) {
          documentElement.appendChild(el).id = jQuery.expando;
          return !document2.getElementsByName || !document2.getElementsByName(jQuery.expando).length;
        });
        support.disconnectedMatch = assert(function(el) {
          return matches.call(el, "*");
        });
        support.scope = assert(function() {
          return document2.querySelectorAll(":scope");
        });
        support.cssHas = assert(function() {
          try {
            document2.querySelector(":has(*,:jqfake)");
            return false;
          } catch (e) {
            return true;
          }
        });
        if (support.getById) {
          Expr.filter.ID = function(id) {
            var attrId = id.replace(runescape, funescape);
            return function(elem) {
              return elem.getAttribute("id") === attrId;
            };
          };
          Expr.find.ID = function(id, context) {
            if (typeof context.getElementById !== "undefined" && documentIsHTML) {
              var elem = context.getElementById(id);
              return elem ? [elem] : [];
            }
          };
        } else {
          Expr.filter.ID = function(id) {
            var attrId = id.replace(runescape, funescape);
            return function(elem) {
              var node = typeof elem.getAttributeNode !== "undefined" && elem.getAttributeNode("id");
              return node && node.value === attrId;
            };
          };
          Expr.find.ID = function(id, context) {
            if (typeof context.getElementById !== "undefined" && documentIsHTML) {
              var node, i, elems, elem = context.getElementById(id);
              if (elem) {
                node = elem.getAttributeNode("id");
                if (node && node.value === id) {
                  return [elem];
                }
                elems = context.getElementsByName(id);
                i = 0;
                while (elem = elems[i++]) {
                  node = elem.getAttributeNode("id");
                  if (node && node.value === id) {
                    return [elem];
                  }
                }
              }
              return [];
            }
          };
        }
        Expr.find.TAG = function(tag, context) {
          if (typeof context.getElementsByTagName !== "undefined") {
            return context.getElementsByTagName(tag);
          } else {
            return context.querySelectorAll(tag);
          }
        };
        Expr.find.CLASS = function(className, context) {
          if (typeof context.getElementsByClassName !== "undefined" && documentIsHTML) {
            return context.getElementsByClassName(className);
          }
        };
        rbuggyQSA = [];
        assert(function(el) {
          var input;
          documentElement.appendChild(el).innerHTML = "<a id='" + expando + "' href='' disabled='disabled'></a>" + "<select id='" + expando + "-\r\\' disabled='disabled'>" + "<option selected=''></option></select>";
          if (!el.querySelectorAll("[selected]").length) {
            rbuggyQSA.push("\\[" + whitespace + "*(?:value|" + booleans + ")");
          }
          if (!el.querySelectorAll("[id~=" + expando + "-]").length) {
            rbuggyQSA.push("~=");
          }
          if (!el.querySelectorAll("a#" + expando + "+*").length) {
            rbuggyQSA.push(".#.+[+~]");
          }
          if (!el.querySelectorAll(":checked").length) {
            rbuggyQSA.push(":checked");
          }
          input = document2.createElement("input");
          input.setAttribute("type", "hidden");
          el.appendChild(input).setAttribute("name", "D");
          documentElement.appendChild(el).disabled = true;
          if (el.querySelectorAll(":disabled").length !== 2) {
            rbuggyQSA.push(":enabled", ":disabled");
          }
          input = document2.createElement("input");
          input.setAttribute("name", "");
          el.appendChild(input);
          if (!el.querySelectorAll("[name='']").length) {
            rbuggyQSA.push("\\[" + whitespace + "*name" + whitespace + "*=" + whitespace + `*(?:''|"")`);
          }
        });
        if (!support.cssHas) {
          rbuggyQSA.push(":has");
        }
        rbuggyQSA = rbuggyQSA.length && new RegExp(rbuggyQSA.join("|"));
        sortOrder = function(a, b) {
          if (a === b) {
            hasDuplicate = true;
            return 0;
          }
          var compare = !a.compareDocumentPosition - !b.compareDocumentPosition;
          if (compare) {
            return compare;
          }
          compare = (a.ownerDocument || a) == (b.ownerDocument || b) ? a.compareDocumentPosition(b) : 1;
          if (compare & 1 || !support.sortDetached && b.compareDocumentPosition(a) === compare) {
            if (a === document2 || a.ownerDocument == preferredDoc && find.contains(preferredDoc, a)) {
              return -1;
            }
            if (b === document2 || b.ownerDocument == preferredDoc && find.contains(preferredDoc, b)) {
              return 1;
            }
            return sortInput ? indexOf.call(sortInput, a) - indexOf.call(sortInput, b) : 0;
          }
          return compare & 4 ? -1 : 1;
        };
        return document2;
      }
      find.matches = function(expr, elements) {
        return find(expr, null, null, elements);
      };
      find.matchesSelector = function(elem, expr) {
        setDocument(elem);
        if (documentIsHTML && !nonnativeSelectorCache[expr + " "] && (!rbuggyQSA || !rbuggyQSA.test(expr))) {
          try {
            var ret = matches.call(elem, expr);
            if (ret || support.disconnectedMatch || elem.document && elem.document.nodeType !== 11) {
              return ret;
            }
          } catch (e) {
            nonnativeSelectorCache(expr, true);
          }
        }
        return find(expr, document2, null, [elem]).length > 0;
      };
      find.contains = function(context, elem) {
        if ((context.ownerDocument || context) != document2) {
          setDocument(context);
        }
        return jQuery.contains(context, elem);
      };
      find.attr = function(elem, name) {
        if ((elem.ownerDocument || elem) != document2) {
          setDocument(elem);
        }
        var fn = Expr.attrHandle[name.toLowerCase()], val = fn && hasOwn.call(Expr.attrHandle, name.toLowerCase()) ? fn(elem, name, !documentIsHTML) : undefined;
        if (val !== undefined) {
          return val;
        }
        return elem.getAttribute(name);
      };
      find.error = function(msg) {
        throw new Error("Syntax error, unrecognized expression: " + msg);
      };
      jQuery.uniqueSort = function(results) {
        var elem, duplicates = [], j = 0, i = 0;
        hasDuplicate = !support.sortStable;
        sortInput = !support.sortStable && slice.call(results, 0);
        sort.call(results, sortOrder);
        if (hasDuplicate) {
          while (elem = results[i++]) {
            if (elem === results[i]) {
              j = duplicates.push(i);
            }
          }
          while (j--) {
            splice.call(results, duplicates[j], 1);
          }
        }
        sortInput = null;
        return results;
      };
      jQuery.fn.uniqueSort = function() {
        return this.pushStack(jQuery.uniqueSort(slice.apply(this)));
      };
      Expr = jQuery.expr = {
        cacheLength: 50,
        createPseudo: markFunction,
        match: matchExpr,
        attrHandle: {},
        find: {},
        relative: {
          ">": { dir: "parentNode", first: true },
          " ": { dir: "parentNode" },
          "+": { dir: "previousSibling", first: true },
          "~": { dir: "previousSibling" }
        },
        preFilter: {
          ATTR: function(match) {
            match[1] = match[1].replace(runescape, funescape);
            match[3] = (match[3] || match[4] || match[5] || "").replace(runescape, funescape);
            if (match[2] === "~=") {
              match[3] = " " + match[3] + " ";
            }
            return match.slice(0, 4);
          },
          CHILD: function(match) {
            match[1] = match[1].toLowerCase();
            if (match[1].slice(0, 3) === "nth") {
              if (!match[3]) {
                find.error(match[0]);
              }
              match[4] = +(match[4] ? match[5] + (match[6] || 1) : 2 * (match[3] === "even" || match[3] === "odd"));
              match[5] = +(match[7] + match[8] || match[3] === "odd");
            } else if (match[3]) {
              find.error(match[0]);
            }
            return match;
          },
          PSEUDO: function(match) {
            var excess, unquoted = !match[6] && match[2];
            if (matchExpr.CHILD.test(match[0])) {
              return null;
            }
            if (match[3]) {
              match[2] = match[4] || match[5] || "";
            } else if (unquoted && rpseudo.test(unquoted) && (excess = tokenize(unquoted, true)) && (excess = unquoted.indexOf(")", unquoted.length - excess) - unquoted.length)) {
              match[0] = match[0].slice(0, excess);
              match[2] = unquoted.slice(0, excess);
            }
            return match.slice(0, 3);
          }
        },
        filter: {
          TAG: function(nodeNameSelector) {
            var expectedNodeName = nodeNameSelector.replace(runescape, funescape).toLowerCase();
            return nodeNameSelector === "*" ? function() {
              return true;
            } : function(elem) {
              return nodeName(elem, expectedNodeName);
            };
          },
          CLASS: function(className) {
            var pattern = classCache[className + " "];
            return pattern || (pattern = new RegExp("(^|" + whitespace + ")" + className + "(" + whitespace + "|$)")) && classCache(className, function(elem) {
              return pattern.test(typeof elem.className === "string" && elem.className || typeof elem.getAttribute !== "undefined" && elem.getAttribute("class") || "");
            });
          },
          ATTR: function(name, operator, check) {
            return function(elem) {
              var result = find.attr(elem, name);
              if (result == null) {
                return operator === "!=";
              }
              if (!operator) {
                return true;
              }
              result += "";
              if (operator === "=") {
                return result === check;
              }
              if (operator === "!=") {
                return result !== check;
              }
              if (operator === "^=") {
                return check && result.indexOf(check) === 0;
              }
              if (operator === "*=") {
                return check && result.indexOf(check) > -1;
              }
              if (operator === "$=") {
                return check && result.slice(-check.length) === check;
              }
              if (operator === "~=") {
                return (" " + result.replace(rwhitespace, " ") + " ").indexOf(check) > -1;
              }
              if (operator === "|=") {
                return result === check || result.slice(0, check.length + 1) === check + "-";
              }
              return false;
            };
          },
          CHILD: function(type, what, _argument, first, last) {
            var simple = type.slice(0, 3) !== "nth", forward = type.slice(-4) !== "last", ofType = what === "of-type";
            return first === 1 && last === 0 ? function(elem) {
              return !!elem.parentNode;
            } : function(elem, _context, xml) {
              var cache, outerCache, node, nodeIndex, start, dir = simple !== forward ? "nextSibling" : "previousSibling", parent = elem.parentNode, name = ofType && elem.nodeName.toLowerCase(), useCache = !xml && !ofType, diff = false;
              if (parent) {
                if (simple) {
                  while (dir) {
                    node = elem;
                    while (node = node[dir]) {
                      if (ofType ? nodeName(node, name) : node.nodeType === 1) {
                        return false;
                      }
                    }
                    start = dir = type === "only" && !start && "nextSibling";
                  }
                  return true;
                }
                start = [forward ? parent.firstChild : parent.lastChild];
                if (forward && useCache) {
                  outerCache = parent[expando] || (parent[expando] = {});
                  cache = outerCache[type] || [];
                  nodeIndex = cache[0] === dirruns && cache[1];
                  diff = nodeIndex && cache[2];
                  node = nodeIndex && parent.childNodes[nodeIndex];
                  while (node = ++nodeIndex && node && node[dir] || (diff = nodeIndex = 0) || start.pop()) {
                    if (node.nodeType === 1 && ++diff && node === elem) {
                      outerCache[type] = [dirruns, nodeIndex, diff];
                      break;
                    }
                  }
                } else {
                  if (useCache) {
                    outerCache = elem[expando] || (elem[expando] = {});
                    cache = outerCache[type] || [];
                    nodeIndex = cache[0] === dirruns && cache[1];
                    diff = nodeIndex;
                  }
                  if (diff === false) {
                    while (node = ++nodeIndex && node && node[dir] || (diff = nodeIndex = 0) || start.pop()) {
                      if ((ofType ? nodeName(node, name) : node.nodeType === 1) && ++diff) {
                        if (useCache) {
                          outerCache = node[expando] || (node[expando] = {});
                          outerCache[type] = [dirruns, diff];
                        }
                        if (node === elem) {
                          break;
                        }
                      }
                    }
                  }
                }
                diff -= last;
                return diff === first || diff % first === 0 && diff / first >= 0;
              }
            };
          },
          PSEUDO: function(pseudo, argument) {
            var args, fn = Expr.pseudos[pseudo] || Expr.setFilters[pseudo.toLowerCase()] || find.error("unsupported pseudo: " + pseudo);
            if (fn[expando]) {
              return fn(argument);
            }
            if (fn.length > 1) {
              args = [pseudo, pseudo, "", argument];
              return Expr.setFilters.hasOwnProperty(pseudo.toLowerCase()) ? markFunction(function(seed, matches) {
                var idx, matched = fn(seed, argument), i = matched.length;
                while (i--) {
                  idx = indexOf.call(seed, matched[i]);
                  seed[idx] = !(matches[idx] = matched[i]);
                }
              }) : function(elem) {
                return fn(elem, 0, args);
              };
            }
            return fn;
          }
        },
        pseudos: {
          not: markFunction(function(selector) {
            var input = [], results = [], matcher = compile(selector.replace(rtrimCSS, "$1"));
            return matcher[expando] ? markFunction(function(seed, matches, _context, xml) {
              var elem, unmatched = matcher(seed, null, xml, []), i = seed.length;
              while (i--) {
                if (elem = unmatched[i]) {
                  seed[i] = !(matches[i] = elem);
                }
              }
            }) : function(elem, _context, xml) {
              input[0] = elem;
              matcher(input, null, xml, results);
              input[0] = null;
              return !results.pop();
            };
          }),
          has: markFunction(function(selector) {
            return function(elem) {
              return find(selector, elem).length > 0;
            };
          }),
          contains: markFunction(function(text) {
            text = text.replace(runescape, funescape);
            return function(elem) {
              return (elem.textContent || jQuery.text(elem)).indexOf(text) > -1;
            };
          }),
          lang: markFunction(function(lang) {
            if (!ridentifier.test(lang || "")) {
              find.error("unsupported lang: " + lang);
            }
            lang = lang.replace(runescape, funescape).toLowerCase();
            return function(elem) {
              var elemLang;
              do {
                if (elemLang = documentIsHTML ? elem.lang : elem.getAttribute("xml:lang") || elem.getAttribute("lang")) {
                  elemLang = elemLang.toLowerCase();
                  return elemLang === lang || elemLang.indexOf(lang + "-") === 0;
                }
              } while ((elem = elem.parentNode) && elem.nodeType === 1);
              return false;
            };
          }),
          target: function(elem) {
            var hash = window2.location && window2.location.hash;
            return hash && hash.slice(1) === elem.id;
          },
          root: function(elem) {
            return elem === documentElement;
          },
          focus: function(elem) {
            return elem === safeActiveElement() && document2.hasFocus() && !!(elem.type || elem.href || ~elem.tabIndex);
          },
          enabled: createDisabledPseudo(false),
          disabled: createDisabledPseudo(true),
          checked: function(elem) {
            return nodeName(elem, "input") && !!elem.checked || nodeName(elem, "option") && !!elem.selected;
          },
          selected: function(elem) {
            if (elem.parentNode) {
              elem.parentNode.selectedIndex;
            }
            return elem.selected === true;
          },
          empty: function(elem) {
            for (elem = elem.firstChild;elem; elem = elem.nextSibling) {
              if (elem.nodeType < 6) {
                return false;
              }
            }
            return true;
          },
          parent: function(elem) {
            return !Expr.pseudos.empty(elem);
          },
          header: function(elem) {
            return rheader.test(elem.nodeName);
          },
          input: function(elem) {
            return rinputs.test(elem.nodeName);
          },
          button: function(elem) {
            return nodeName(elem, "input") && elem.type === "button" || nodeName(elem, "button");
          },
          text: function(elem) {
            var attr;
            return nodeName(elem, "input") && elem.type === "text" && ((attr = elem.getAttribute("type")) == null || attr.toLowerCase() === "text");
          },
          first: createPositionalPseudo(function() {
            return [0];
          }),
          last: createPositionalPseudo(function(_matchIndexes, length) {
            return [length - 1];
          }),
          eq: createPositionalPseudo(function(_matchIndexes, length, argument) {
            return [argument < 0 ? argument + length : argument];
          }),
          even: createPositionalPseudo(function(matchIndexes, length) {
            var i = 0;
            for (;i < length; i += 2) {
              matchIndexes.push(i);
            }
            return matchIndexes;
          }),
          odd: createPositionalPseudo(function(matchIndexes, length) {
            var i = 1;
            for (;i < length; i += 2) {
              matchIndexes.push(i);
            }
            return matchIndexes;
          }),
          lt: createPositionalPseudo(function(matchIndexes, length, argument) {
            var i;
            if (argument < 0) {
              i = argument + length;
            } else if (argument > length) {
              i = length;
            } else {
              i = argument;
            }
            for (;--i >= 0; ) {
              matchIndexes.push(i);
            }
            return matchIndexes;
          }),
          gt: createPositionalPseudo(function(matchIndexes, length, argument) {
            var i = argument < 0 ? argument + length : argument;
            for (;++i < length; ) {
              matchIndexes.push(i);
            }
            return matchIndexes;
          })
        }
      };
      Expr.pseudos.nth = Expr.pseudos.eq;
      for (i in { radio: true, checkbox: true, file: true, password: true, image: true }) {
        Expr.pseudos[i] = createInputPseudo(i);
      }
      for (i in { submit: true, reset: true }) {
        Expr.pseudos[i] = createButtonPseudo(i);
      }
      function setFilters() {}
      setFilters.prototype = Expr.filters = Expr.pseudos;
      Expr.setFilters = new setFilters;
      function tokenize(selector, parseOnly) {
        var matched, match, tokens, type, soFar, groups, preFilters, cached = tokenCache[selector + " "];
        if (cached) {
          return parseOnly ? 0 : cached.slice(0);
        }
        soFar = selector;
        groups = [];
        preFilters = Expr.preFilter;
        while (soFar) {
          if (!matched || (match = rcomma.exec(soFar))) {
            if (match) {
              soFar = soFar.slice(match[0].length) || soFar;
            }
            groups.push(tokens = []);
          }
          matched = false;
          if (match = rleadingCombinator.exec(soFar)) {
            matched = match.shift();
            tokens.push({
              value: matched,
              type: match[0].replace(rtrimCSS, " ")
            });
            soFar = soFar.slice(matched.length);
          }
          for (type in Expr.filter) {
            if ((match = matchExpr[type].exec(soFar)) && (!preFilters[type] || (match = preFilters[type](match)))) {
              matched = match.shift();
              tokens.push({
                value: matched,
                type,
                matches: match
              });
              soFar = soFar.slice(matched.length);
            }
          }
          if (!matched) {
            break;
          }
        }
        if (parseOnly) {
          return soFar.length;
        }
        return soFar ? find.error(selector) : tokenCache(selector, groups).slice(0);
      }
      function toSelector(tokens) {
        var i = 0, len = tokens.length, selector = "";
        for (;i < len; i++) {
          selector += tokens[i].value;
        }
        return selector;
      }
      function addCombinator(matcher, combinator, base) {
        var { dir, next: skip } = combinator, key = skip || dir, checkNonElements = base && key === "parentNode", doneName = done++;
        return combinator.first ? function(elem, context, xml) {
          while (elem = elem[dir]) {
            if (elem.nodeType === 1 || checkNonElements) {
              return matcher(elem, context, xml);
            }
          }
          return false;
        } : function(elem, context, xml) {
          var oldCache, outerCache, newCache = [dirruns, doneName];
          if (xml) {
            while (elem = elem[dir]) {
              if (elem.nodeType === 1 || checkNonElements) {
                if (matcher(elem, context, xml)) {
                  return true;
                }
              }
            }
          } else {
            while (elem = elem[dir]) {
              if (elem.nodeType === 1 || checkNonElements) {
                outerCache = elem[expando] || (elem[expando] = {});
                if (skip && nodeName(elem, skip)) {
                  elem = elem[dir] || elem;
                } else if ((oldCache = outerCache[key]) && oldCache[0] === dirruns && oldCache[1] === doneName) {
                  return newCache[2] = oldCache[2];
                } else {
                  outerCache[key] = newCache;
                  if (newCache[2] = matcher(elem, context, xml)) {
                    return true;
                  }
                }
              }
            }
          }
          return false;
        };
      }
      function elementMatcher(matchers) {
        return matchers.length > 1 ? function(elem, context, xml) {
          var i = matchers.length;
          while (i--) {
            if (!matchers[i](elem, context, xml)) {
              return false;
            }
          }
          return true;
        } : matchers[0];
      }
      function multipleContexts(selector, contexts, results) {
        var i = 0, len = contexts.length;
        for (;i < len; i++) {
          find(selector, contexts[i], results);
        }
        return results;
      }
      function condense(unmatched, map, filter, context, xml) {
        var elem, newUnmatched = [], i = 0, len = unmatched.length, mapped = map != null;
        for (;i < len; i++) {
          if (elem = unmatched[i]) {
            if (!filter || filter(elem, context, xml)) {
              newUnmatched.push(elem);
              if (mapped) {
                map.push(i);
              }
            }
          }
        }
        return newUnmatched;
      }
      function setMatcher(preFilter, selector, matcher, postFilter, postFinder, postSelector) {
        if (postFilter && !postFilter[expando]) {
          postFilter = setMatcher(postFilter);
        }
        if (postFinder && !postFinder[expando]) {
          postFinder = setMatcher(postFinder, postSelector);
        }
        return markFunction(function(seed, results, context, xml) {
          var temp, i, elem, matcherOut, preMap = [], postMap = [], preexisting = results.length, elems = seed || multipleContexts(selector || "*", context.nodeType ? [context] : context, []), matcherIn = preFilter && (seed || !selector) ? condense(elems, preMap, preFilter, context, xml) : elems;
          if (matcher) {
            matcherOut = postFinder || (seed ? preFilter : preexisting || postFilter) ? [] : results;
            matcher(matcherIn, matcherOut, context, xml);
          } else {
            matcherOut = matcherIn;
          }
          if (postFilter) {
            temp = condense(matcherOut, postMap);
            postFilter(temp, [], context, xml);
            i = temp.length;
            while (i--) {
              if (elem = temp[i]) {
                matcherOut[postMap[i]] = !(matcherIn[postMap[i]] = elem);
              }
            }
          }
          if (seed) {
            if (postFinder || preFilter) {
              if (postFinder) {
                temp = [];
                i = matcherOut.length;
                while (i--) {
                  if (elem = matcherOut[i]) {
                    temp.push(matcherIn[i] = elem);
                  }
                }
                postFinder(null, matcherOut = [], temp, xml);
              }
              i = matcherOut.length;
              while (i--) {
                if ((elem = matcherOut[i]) && (temp = postFinder ? indexOf.call(seed, elem) : preMap[i]) > -1) {
                  seed[temp] = !(results[temp] = elem);
                }
              }
            }
          } else {
            matcherOut = condense(matcherOut === results ? matcherOut.splice(preexisting, matcherOut.length) : matcherOut);
            if (postFinder) {
              postFinder(null, results, matcherOut, xml);
            } else {
              push.apply(results, matcherOut);
            }
          }
        });
      }
      function matcherFromTokens(tokens) {
        var checkContext, matcher, j, len = tokens.length, leadingRelative = Expr.relative[tokens[0].type], implicitRelative = leadingRelative || Expr.relative[" "], i = leadingRelative ? 1 : 0, matchContext = addCombinator(function(elem) {
          return elem === checkContext;
        }, implicitRelative, true), matchAnyContext = addCombinator(function(elem) {
          return indexOf.call(checkContext, elem) > -1;
        }, implicitRelative, true), matchers = [function(elem, context, xml) {
          var ret = !leadingRelative && (xml || context != outermostContext) || ((checkContext = context).nodeType ? matchContext(elem, context, xml) : matchAnyContext(elem, context, xml));
          checkContext = null;
          return ret;
        }];
        for (;i < len; i++) {
          if (matcher = Expr.relative[tokens[i].type]) {
            matchers = [addCombinator(elementMatcher(matchers), matcher)];
          } else {
            matcher = Expr.filter[tokens[i].type].apply(null, tokens[i].matches);
            if (matcher[expando]) {
              j = ++i;
              for (;j < len; j++) {
                if (Expr.relative[tokens[j].type]) {
                  break;
                }
              }
              return setMatcher(i > 1 && elementMatcher(matchers), i > 1 && toSelector(tokens.slice(0, i - 1).concat({ value: tokens[i - 2].type === " " ? "*" : "" })).replace(rtrimCSS, "$1"), matcher, i < j && matcherFromTokens(tokens.slice(i, j)), j < len && matcherFromTokens(tokens = tokens.slice(j)), j < len && toSelector(tokens));
            }
            matchers.push(matcher);
          }
        }
        return elementMatcher(matchers);
      }
      function matcherFromGroupMatchers(elementMatchers, setMatchers) {
        var bySet = setMatchers.length > 0, byElement = elementMatchers.length > 0, superMatcher = function(seed, context, xml, results, outermost) {
          var elem, j, matcher, matchedCount = 0, i = "0", unmatched = seed && [], setMatched = [], contextBackup = outermostContext, elems = seed || byElement && Expr.find.TAG("*", outermost), dirrunsUnique = dirruns += contextBackup == null ? 1 : Math.random() || 0.1, len = elems.length;
          if (outermost) {
            outermostContext = context == document2 || context || outermost;
          }
          for (;i !== len && (elem = elems[i]) != null; i++) {
            if (byElement && elem) {
              j = 0;
              if (!context && elem.ownerDocument != document2) {
                setDocument(elem);
                xml = !documentIsHTML;
              }
              while (matcher = elementMatchers[j++]) {
                if (matcher(elem, context || document2, xml)) {
                  push.call(results, elem);
                  break;
                }
              }
              if (outermost) {
                dirruns = dirrunsUnique;
              }
            }
            if (bySet) {
              if (elem = !matcher && elem) {
                matchedCount--;
              }
              if (seed) {
                unmatched.push(elem);
              }
            }
          }
          matchedCount += i;
          if (bySet && i !== matchedCount) {
            j = 0;
            while (matcher = setMatchers[j++]) {
              matcher(unmatched, setMatched, context, xml);
            }
            if (seed) {
              if (matchedCount > 0) {
                while (i--) {
                  if (!(unmatched[i] || setMatched[i])) {
                    setMatched[i] = pop.call(results);
                  }
                }
              }
              setMatched = condense(setMatched);
            }
            push.apply(results, setMatched);
            if (outermost && !seed && setMatched.length > 0 && matchedCount + setMatchers.length > 1) {
              jQuery.uniqueSort(results);
            }
          }
          if (outermost) {
            dirruns = dirrunsUnique;
            outermostContext = contextBackup;
          }
          return unmatched;
        };
        return bySet ? markFunction(superMatcher) : superMatcher;
      }
      function compile(selector, match) {
        var i, setMatchers = [], elementMatchers = [], cached = compilerCache[selector + " "];
        if (!cached) {
          if (!match) {
            match = tokenize(selector);
          }
          i = match.length;
          while (i--) {
            cached = matcherFromTokens(match[i]);
            if (cached[expando]) {
              setMatchers.push(cached);
            } else {
              elementMatchers.push(cached);
            }
          }
          cached = compilerCache(selector, matcherFromGroupMatchers(elementMatchers, setMatchers));
          cached.selector = selector;
        }
        return cached;
      }
      function select(selector, context, results, seed) {
        var i, tokens, token, type, find, compiled = typeof selector === "function" && selector, match = !seed && tokenize(selector = compiled.selector || selector);
        results = results || [];
        if (match.length === 1) {
          tokens = match[0] = match[0].slice(0);
          if (tokens.length > 2 && (token = tokens[0]).type === "ID" && context.nodeType === 9 && documentIsHTML && Expr.relative[tokens[1].type]) {
            context = (Expr.find.ID(token.matches[0].replace(runescape, funescape), context) || [])[0];
            if (!context) {
              return results;
            } else if (compiled) {
              context = context.parentNode;
            }
            selector = selector.slice(tokens.shift().value.length);
          }
          i = matchExpr.needsContext.test(selector) ? 0 : tokens.length;
          while (i--) {
            token = tokens[i];
            if (Expr.relative[type = token.type]) {
              break;
            }
            if (find = Expr.find[type]) {
              if (seed = find(token.matches[0].replace(runescape, funescape), rsibling.test(tokens[0].type) && testContext(context.parentNode) || context)) {
                tokens.splice(i, 1);
                selector = seed.length && toSelector(tokens);
                if (!selector) {
                  push.apply(results, seed);
                  return results;
                }
                break;
              }
            }
          }
        }
        (compiled || compile(selector, match))(seed, context, !documentIsHTML, results, !context || rsibling.test(selector) && testContext(context.parentNode) || context);
        return results;
      }
      support.sortStable = expando.split("").sort(sortOrder).join("") === expando;
      setDocument();
      support.sortDetached = assert(function(el) {
        return el.compareDocumentPosition(document2.createElement("fieldset")) & 1;
      });
      jQuery.find = find;
      jQuery.expr[":"] = jQuery.expr.pseudos;
      jQuery.unique = jQuery.uniqueSort;
      find.compile = compile;
      find.select = select;
      find.setDocument = setDocument;
      find.tokenize = tokenize;
      find.escape = jQuery.escapeSelector;
      find.getText = jQuery.text;
      find.isXML = jQuery.isXMLDoc;
      find.selectors = jQuery.expr;
      find.support = jQuery.support;
      find.uniqueSort = jQuery.uniqueSort;
    })();
    var dir = function(elem, dir, until) {
      var matched = [], truncate = until !== undefined;
      while ((elem = elem[dir]) && elem.nodeType !== 9) {
        if (elem.nodeType === 1) {
          if (truncate && jQuery(elem).is(until)) {
            break;
          }
          matched.push(elem);
        }
      }
      return matched;
    };
    var siblings = function(n, elem) {
      var matched = [];
      for (;n; n = n.nextSibling) {
        if (n.nodeType === 1 && n !== elem) {
          matched.push(n);
        }
      }
      return matched;
    };
    var rneedsContext = jQuery.expr.match.needsContext;
    var rsingleTag = /^<([a-z][^\/\0>:\x20\t\r\n\f]*)[\x20\t\r\n\f]*\/?>(?:<\/\1>|)$/i;
    function winnow(elements, qualifier, not) {
      if (isFunction(qualifier)) {
        return jQuery.grep(elements, function(elem, i) {
          return !!qualifier.call(elem, i, elem) !== not;
        });
      }
      if (qualifier.nodeType) {
        return jQuery.grep(elements, function(elem) {
          return elem === qualifier !== not;
        });
      }
      if (typeof qualifier !== "string") {
        return jQuery.grep(elements, function(elem) {
          return indexOf.call(qualifier, elem) > -1 !== not;
        });
      }
      return jQuery.filter(qualifier, elements, not);
    }
    jQuery.filter = function(expr, elems, not) {
      var elem = elems[0];
      if (not) {
        expr = ":not(" + expr + ")";
      }
      if (elems.length === 1 && elem.nodeType === 1) {
        return jQuery.find.matchesSelector(elem, expr) ? [elem] : [];
      }
      return jQuery.find.matches(expr, jQuery.grep(elems, function(elem) {
        return elem.nodeType === 1;
      }));
    };
    jQuery.fn.extend({
      find: function(selector) {
        var i, ret, len = this.length, self = this;
        if (typeof selector !== "string") {
          return this.pushStack(jQuery(selector).filter(function() {
            for (i = 0;i < len; i++) {
              if (jQuery.contains(self[i], this)) {
                return true;
              }
            }
          }));
        }
        ret = this.pushStack([]);
        for (i = 0;i < len; i++) {
          jQuery.find(selector, self[i], ret);
        }
        return len > 1 ? jQuery.uniqueSort(ret) : ret;
      },
      filter: function(selector) {
        return this.pushStack(winnow(this, selector || [], false));
      },
      not: function(selector) {
        return this.pushStack(winnow(this, selector || [], true));
      },
      is: function(selector) {
        return !!winnow(this, typeof selector === "string" && rneedsContext.test(selector) ? jQuery(selector) : selector || [], false).length;
      }
    });
    var rootjQuery, rquickExpr = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]+))$/, init = jQuery.fn.init = function(selector, context, root) {
      var match, elem;
      if (!selector) {
        return this;
      }
      root = root || rootjQuery;
      if (typeof selector === "string") {
        if (selector[0] === "<" && selector[selector.length - 1] === ">" && selector.length >= 3) {
          match = [null, selector, null];
        } else {
          match = rquickExpr.exec(selector);
        }
        if (match && (match[1] || !context)) {
          if (match[1]) {
            context = context instanceof jQuery ? context[0] : context;
            jQuery.merge(this, jQuery.parseHTML(match[1], context && context.nodeType ? context.ownerDocument || context : document2, true));
            if (rsingleTag.test(match[1]) && jQuery.isPlainObject(context)) {
              for (match in context) {
                if (isFunction(this[match])) {
                  this[match](context[match]);
                } else {
                  this.attr(match, context[match]);
                }
              }
            }
            return this;
          } else {
            elem = document2.getElementById(match[2]);
            if (elem) {
              this[0] = elem;
              this.length = 1;
            }
            return this;
          }
        } else if (!context || context.jquery) {
          return (context || root).find(selector);
        } else {
          return this.constructor(context).find(selector);
        }
      } else if (selector.nodeType) {
        this[0] = selector;
        this.length = 1;
        return this;
      } else if (isFunction(selector)) {
        return root.ready !== undefined ? root.ready(selector) : selector(jQuery);
      }
      return jQuery.makeArray(selector, this);
    };
    init.prototype = jQuery.fn;
    rootjQuery = jQuery(document2);
    var rparentsprev = /^(?:parents|prev(?:Until|All))/, guaranteedUnique = {
      children: true,
      contents: true,
      next: true,
      prev: true
    };
    jQuery.fn.extend({
      has: function(target) {
        var targets = jQuery(target, this), l = targets.length;
        return this.filter(function() {
          var i = 0;
          for (;i < l; i++) {
            if (jQuery.contains(this, targets[i])) {
              return true;
            }
          }
        });
      },
      closest: function(selectors, context) {
        var cur, i = 0, l = this.length, matched = [], targets = typeof selectors !== "string" && jQuery(selectors);
        if (!rneedsContext.test(selectors)) {
          for (;i < l; i++) {
            for (cur = this[i];cur && cur !== context; cur = cur.parentNode) {
              if (cur.nodeType < 11 && (targets ? targets.index(cur) > -1 : cur.nodeType === 1 && jQuery.find.matchesSelector(cur, selectors))) {
                matched.push(cur);
                break;
              }
            }
          }
        }
        return this.pushStack(matched.length > 1 ? jQuery.uniqueSort(matched) : matched);
      },
      index: function(elem) {
        if (!elem) {
          return this[0] && this[0].parentNode ? this.first().prevAll().length : -1;
        }
        if (typeof elem === "string") {
          return indexOf.call(jQuery(elem), this[0]);
        }
        return indexOf.call(this, elem.jquery ? elem[0] : elem);
      },
      add: function(selector, context) {
        return this.pushStack(jQuery.uniqueSort(jQuery.merge(this.get(), jQuery(selector, context))));
      },
      addBack: function(selector) {
        return this.add(selector == null ? this.prevObject : this.prevObject.filter(selector));
      }
    });
    function sibling(cur, dir) {
      while ((cur = cur[dir]) && cur.nodeType !== 1) {}
      return cur;
    }
    jQuery.each({
      parent: function(elem) {
        var parent = elem.parentNode;
        return parent && parent.nodeType !== 11 ? parent : null;
      },
      parents: function(elem) {
        return dir(elem, "parentNode");
      },
      parentsUntil: function(elem, _i, until) {
        return dir(elem, "parentNode", until);
      },
      next: function(elem) {
        return sibling(elem, "nextSibling");
      },
      prev: function(elem) {
        return sibling(elem, "previousSibling");
      },
      nextAll: function(elem) {
        return dir(elem, "nextSibling");
      },
      prevAll: function(elem) {
        return dir(elem, "previousSibling");
      },
      nextUntil: function(elem, _i, until) {
        return dir(elem, "nextSibling", until);
      },
      prevUntil: function(elem, _i, until) {
        return dir(elem, "previousSibling", until);
      },
      siblings: function(elem) {
        return siblings((elem.parentNode || {}).firstChild, elem);
      },
      children: function(elem) {
        return siblings(elem.firstChild);
      },
      contents: function(elem) {
        if (elem.contentDocument != null && getProto(elem.contentDocument)) {
          return elem.contentDocument;
        }
        if (nodeName(elem, "template")) {
          elem = elem.content || elem;
        }
        return jQuery.merge([], elem.childNodes);
      }
    }, function(name, fn) {
      jQuery.fn[name] = function(until, selector) {
        var matched = jQuery.map(this, fn, until);
        if (name.slice(-5) !== "Until") {
          selector = until;
        }
        if (selector && typeof selector === "string") {
          matched = jQuery.filter(selector, matched);
        }
        if (this.length > 1) {
          if (!guaranteedUnique[name]) {
            jQuery.uniqueSort(matched);
          }
          if (rparentsprev.test(name)) {
            matched.reverse();
          }
        }
        return this.pushStack(matched);
      };
    });
    var rnothtmlwhite = /[^\x20\t\r\n\f]+/g;
    function createOptions(options) {
      var object = {};
      jQuery.each(options.match(rnothtmlwhite) || [], function(_, flag) {
        object[flag] = true;
      });
      return object;
    }
    jQuery.Callbacks = function(options) {
      options = typeof options === "string" ? createOptions(options) : jQuery.extend({}, options);
      var firing, memory, fired, locked, list = [], queue = [], firingIndex = -1, fire = function() {
        locked = locked || options.once;
        fired = firing = true;
        for (;queue.length; firingIndex = -1) {
          memory = queue.shift();
          while (++firingIndex < list.length) {
            if (list[firingIndex].apply(memory[0], memory[1]) === false && options.stopOnFalse) {
              firingIndex = list.length;
              memory = false;
            }
          }
        }
        if (!options.memory) {
          memory = false;
        }
        firing = false;
        if (locked) {
          if (memory) {
            list = [];
          } else {
            list = "";
          }
        }
      }, self = {
        add: function() {
          if (list) {
            if (memory && !firing) {
              firingIndex = list.length - 1;
              queue.push(memory);
            }
            (function add(args) {
              jQuery.each(args, function(_, arg) {
                if (isFunction(arg)) {
                  if (!options.unique || !self.has(arg)) {
                    list.push(arg);
                  }
                } else if (arg && arg.length && toType(arg) !== "string") {
                  add(arg);
                }
              });
            })(arguments);
            if (memory && !firing) {
              fire();
            }
          }
          return this;
        },
        remove: function() {
          jQuery.each(arguments, function(_, arg) {
            var index;
            while ((index = jQuery.inArray(arg, list, index)) > -1) {
              list.splice(index, 1);
              if (index <= firingIndex) {
                firingIndex--;
              }
            }
          });
          return this;
        },
        has: function(fn) {
          return fn ? jQuery.inArray(fn, list) > -1 : list.length > 0;
        },
        empty: function() {
          if (list) {
            list = [];
          }
          return this;
        },
        disable: function() {
          locked = queue = [];
          list = memory = "";
          return this;
        },
        disabled: function() {
          return !list;
        },
        lock: function() {
          locked = queue = [];
          if (!memory && !firing) {
            list = memory = "";
          }
          return this;
        },
        locked: function() {
          return !!locked;
        },
        fireWith: function(context, args) {
          if (!locked) {
            args = args || [];
            args = [context, args.slice ? args.slice() : args];
            queue.push(args);
            if (!firing) {
              fire();
            }
          }
          return this;
        },
        fire: function() {
          self.fireWith(this, arguments);
          return this;
        },
        fired: function() {
          return !!fired;
        }
      };
      return self;
    };
    function Identity(v) {
      return v;
    }
    function Thrower(ex) {
      throw ex;
    }
    function adoptValue(value, resolve, reject, noValue) {
      var method;
      try {
        if (value && isFunction(method = value.promise)) {
          method.call(value).done(resolve).fail(reject);
        } else if (value && isFunction(method = value.then)) {
          method.call(value, resolve, reject);
        } else {
          resolve.apply(undefined, [value].slice(noValue));
        }
      } catch (value) {
        reject.apply(undefined, [value]);
      }
    }
    jQuery.extend({
      Deferred: function(func) {
        var tuples = [
          [
            "notify",
            "progress",
            jQuery.Callbacks("memory"),
            jQuery.Callbacks("memory"),
            2
          ],
          [
            "resolve",
            "done",
            jQuery.Callbacks("once memory"),
            jQuery.Callbacks("once memory"),
            0,
            "resolved"
          ],
          [
            "reject",
            "fail",
            jQuery.Callbacks("once memory"),
            jQuery.Callbacks("once memory"),
            1,
            "rejected"
          ]
        ], state = "pending", promise = {
          state: function() {
            return state;
          },
          always: function() {
            deferred.done(arguments).fail(arguments);
            return this;
          },
          catch: function(fn) {
            return promise.then(null, fn);
          },
          pipe: function() {
            var fns = arguments;
            return jQuery.Deferred(function(newDefer) {
              jQuery.each(tuples, function(_i, tuple) {
                var fn = isFunction(fns[tuple[4]]) && fns[tuple[4]];
                deferred[tuple[1]](function() {
                  var returned = fn && fn.apply(this, arguments);
                  if (returned && isFunction(returned.promise)) {
                    returned.promise().progress(newDefer.notify).done(newDefer.resolve).fail(newDefer.reject);
                  } else {
                    newDefer[tuple[0] + "With"](this, fn ? [returned] : arguments);
                  }
                });
              });
              fns = null;
            }).promise();
          },
          then: function(onFulfilled, onRejected, onProgress) {
            var maxDepth = 0;
            function resolve(depth, deferred, handler, special) {
              return function() {
                var that = this, args = arguments, mightThrow = function() {
                  var returned, then;
                  if (depth < maxDepth) {
                    return;
                  }
                  returned = handler.apply(that, args);
                  if (returned === deferred.promise()) {
                    throw new TypeError("Thenable self-resolution");
                  }
                  then = returned && (typeof returned === "object" || typeof returned === "function") && returned.then;
                  if (isFunction(then)) {
                    if (special) {
                      then.call(returned, resolve(maxDepth, deferred, Identity, special), resolve(maxDepth, deferred, Thrower, special));
                    } else {
                      maxDepth++;
                      then.call(returned, resolve(maxDepth, deferred, Identity, special), resolve(maxDepth, deferred, Thrower, special), resolve(maxDepth, deferred, Identity, deferred.notifyWith));
                    }
                  } else {
                    if (handler !== Identity) {
                      that = undefined;
                      args = [returned];
                    }
                    (special || deferred.resolveWith)(that, args);
                  }
                }, process = special ? mightThrow : function() {
                  try {
                    mightThrow();
                  } catch (e) {
                    if (jQuery.Deferred.exceptionHook) {
                      jQuery.Deferred.exceptionHook(e, process.error);
                    }
                    if (depth + 1 >= maxDepth) {
                      if (handler !== Thrower) {
                        that = undefined;
                        args = [e];
                      }
                      deferred.rejectWith(that, args);
                    }
                  }
                };
                if (depth) {
                  process();
                } else {
                  if (jQuery.Deferred.getErrorHook) {
                    process.error = jQuery.Deferred.getErrorHook();
                  } else if (jQuery.Deferred.getStackHook) {
                    process.error = jQuery.Deferred.getStackHook();
                  }
                  window2.setTimeout(process);
                }
              };
            }
            return jQuery.Deferred(function(newDefer) {
              tuples[0][3].add(resolve(0, newDefer, isFunction(onProgress) ? onProgress : Identity, newDefer.notifyWith));
              tuples[1][3].add(resolve(0, newDefer, isFunction(onFulfilled) ? onFulfilled : Identity));
              tuples[2][3].add(resolve(0, newDefer, isFunction(onRejected) ? onRejected : Thrower));
            }).promise();
          },
          promise: function(obj) {
            return obj != null ? jQuery.extend(obj, promise) : promise;
          }
        }, deferred = {};
        jQuery.each(tuples, function(i, tuple) {
          var list = tuple[2], stateString = tuple[5];
          promise[tuple[1]] = list.add;
          if (stateString) {
            list.add(function() {
              state = stateString;
            }, tuples[3 - i][2].disable, tuples[3 - i][3].disable, tuples[0][2].lock, tuples[0][3].lock);
          }
          list.add(tuple[3].fire);
          deferred[tuple[0]] = function() {
            deferred[tuple[0] + "With"](this === deferred ? undefined : this, arguments);
            return this;
          };
          deferred[tuple[0] + "With"] = list.fireWith;
        });
        promise.promise(deferred);
        if (func) {
          func.call(deferred, deferred);
        }
        return deferred;
      },
      when: function(singleValue) {
        var remaining = arguments.length, i = remaining, resolveContexts = Array(i), resolveValues = slice.call(arguments), primary = jQuery.Deferred(), updateFunc = function(i) {
          return function(value) {
            resolveContexts[i] = this;
            resolveValues[i] = arguments.length > 1 ? slice.call(arguments) : value;
            if (!--remaining) {
              primary.resolveWith(resolveContexts, resolveValues);
            }
          };
        };
        if (remaining <= 1) {
          adoptValue(singleValue, primary.done(updateFunc(i)).resolve, primary.reject, !remaining);
          if (primary.state() === "pending" || isFunction(resolveValues[i] && resolveValues[i].then)) {
            return primary.then();
          }
        }
        while (i--) {
          adoptValue(resolveValues[i], updateFunc(i), primary.reject);
        }
        return primary.promise();
      }
    });
    var rerrorNames = /^(Eval|Internal|Range|Reference|Syntax|Type|URI)Error$/;
    jQuery.Deferred.exceptionHook = function(error, asyncError) {
      if (window2.console && window2.console.warn && error && rerrorNames.test(error.name)) {
        window2.console.warn("jQuery.Deferred exception: " + error.message, error.stack, asyncError);
      }
    };
    jQuery.readyException = function(error) {
      window2.setTimeout(function() {
        throw error;
      });
    };
    var readyList = jQuery.Deferred();
    jQuery.fn.ready = function(fn) {
      readyList.then(fn).catch(function(error) {
        jQuery.readyException(error);
      });
      return this;
    };
    jQuery.extend({
      isReady: false,
      readyWait: 1,
      ready: function(wait) {
        if (wait === true ? --jQuery.readyWait : jQuery.isReady) {
          return;
        }
        jQuery.isReady = true;
        if (wait !== true && --jQuery.readyWait > 0) {
          return;
        }
        readyList.resolveWith(document2, [jQuery]);
      }
    });
    jQuery.ready.then = readyList.then;
    function completed() {
      document2.removeEventListener("DOMContentLoaded", completed);
      window2.removeEventListener("load", completed);
      jQuery.ready();
    }
    if (document2.readyState === "complete" || document2.readyState !== "loading" && !document2.documentElement.doScroll) {
      window2.setTimeout(jQuery.ready);
    } else {
      document2.addEventListener("DOMContentLoaded", completed);
      window2.addEventListener("load", completed);
    }
    var access = function(elems, fn, key, value, chainable, emptyGet, raw) {
      var i = 0, len = elems.length, bulk = key == null;
      if (toType(key) === "object") {
        chainable = true;
        for (i in key) {
          access(elems, fn, i, key[i], true, emptyGet, raw);
        }
      } else if (value !== undefined) {
        chainable = true;
        if (!isFunction(value)) {
          raw = true;
        }
        if (bulk) {
          if (raw) {
            fn.call(elems, value);
            fn = null;
          } else {
            bulk = fn;
            fn = function(elem, _key, value) {
              return bulk.call(jQuery(elem), value);
            };
          }
        }
        if (fn) {
          for (;i < len; i++) {
            fn(elems[i], key, raw ? value : value.call(elems[i], i, fn(elems[i], key)));
          }
        }
      }
      if (chainable) {
        return elems;
      }
      if (bulk) {
        return fn.call(elems);
      }
      return len ? fn(elems[0], key) : emptyGet;
    };
    var rmsPrefix = /^-ms-/, rdashAlpha = /-([a-z])/g;
    function fcamelCase(_all, letter) {
      return letter.toUpperCase();
    }
    function camelCase(string) {
      return string.replace(rmsPrefix, "ms-").replace(rdashAlpha, fcamelCase);
    }
    var acceptData = function(owner) {
      return owner.nodeType === 1 || owner.nodeType === 9 || !+owner.nodeType;
    };
    function Data() {
      this.expando = jQuery.expando + Data.uid++;
    }
    Data.uid = 1;
    Data.prototype = {
      cache: function(owner) {
        var value = owner[this.expando];
        if (!value) {
          value = {};
          if (acceptData(owner)) {
            if (owner.nodeType) {
              owner[this.expando] = value;
            } else {
              Object.defineProperty(owner, this.expando, {
                value,
                configurable: true
              });
            }
          }
        }
        return value;
      },
      set: function(owner, data, value) {
        var prop, cache = this.cache(owner);
        if (typeof data === "string") {
          cache[camelCase(data)] = value;
        } else {
          for (prop in data) {
            cache[camelCase(prop)] = data[prop];
          }
        }
        return cache;
      },
      get: function(owner, key) {
        return key === undefined ? this.cache(owner) : owner[this.expando] && owner[this.expando][camelCase(key)];
      },
      access: function(owner, key, value) {
        if (key === undefined || key && typeof key === "string" && value === undefined) {
          return this.get(owner, key);
        }
        this.set(owner, key, value);
        return value !== undefined ? value : key;
      },
      remove: function(owner, key) {
        var i, cache = owner[this.expando];
        if (cache === undefined) {
          return;
        }
        if (key !== undefined) {
          if (Array.isArray(key)) {
            key = key.map(camelCase);
          } else {
            key = camelCase(key);
            key = key in cache ? [key] : key.match(rnothtmlwhite) || [];
          }
          i = key.length;
          while (i--) {
            delete cache[key[i]];
          }
        }
        if (key === undefined || jQuery.isEmptyObject(cache)) {
          if (owner.nodeType) {
            owner[this.expando] = undefined;
          } else {
            delete owner[this.expando];
          }
        }
      },
      hasData: function(owner) {
        var cache = owner[this.expando];
        return cache !== undefined && !jQuery.isEmptyObject(cache);
      }
    };
    var dataPriv = new Data;
    var dataUser = new Data;
    var rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/, rmultiDash = /[A-Z]/g;
    function getData(data) {
      if (data === "true") {
        return true;
      }
      if (data === "false") {
        return false;
      }
      if (data === "null") {
        return null;
      }
      if (data === +data + "") {
        return +data;
      }
      if (rbrace.test(data)) {
        return JSON.parse(data);
      }
      return data;
    }
    function dataAttr(elem, key, data) {
      var name;
      if (data === undefined && elem.nodeType === 1) {
        name = "data-" + key.replace(rmultiDash, "-$&").toLowerCase();
        data = elem.getAttribute(name);
        if (typeof data === "string") {
          try {
            data = getData(data);
          } catch (e) {}
          dataUser.set(elem, key, data);
        } else {
          data = undefined;
        }
      }
      return data;
    }
    jQuery.extend({
      hasData: function(elem) {
        return dataUser.hasData(elem) || dataPriv.hasData(elem);
      },
      data: function(elem, name, data) {
        return dataUser.access(elem, name, data);
      },
      removeData: function(elem, name) {
        dataUser.remove(elem, name);
      },
      _data: function(elem, name, data) {
        return dataPriv.access(elem, name, data);
      },
      _removeData: function(elem, name) {
        dataPriv.remove(elem, name);
      }
    });
    jQuery.fn.extend({
      data: function(key, value) {
        var i, name, data, elem = this[0], attrs = elem && elem.attributes;
        if (key === undefined) {
          if (this.length) {
            data = dataUser.get(elem);
            if (elem.nodeType === 1 && !dataPriv.get(elem, "hasDataAttrs")) {
              i = attrs.length;
              while (i--) {
                if (attrs[i]) {
                  name = attrs[i].name;
                  if (name.indexOf("data-") === 0) {
                    name = camelCase(name.slice(5));
                    dataAttr(elem, name, data[name]);
                  }
                }
              }
              dataPriv.set(elem, "hasDataAttrs", true);
            }
          }
          return data;
        }
        if (typeof key === "object") {
          return this.each(function() {
            dataUser.set(this, key);
          });
        }
        return access(this, function(value) {
          var data;
          if (elem && value === undefined) {
            data = dataUser.get(elem, key);
            if (data !== undefined) {
              return data;
            }
            data = dataAttr(elem, key);
            if (data !== undefined) {
              return data;
            }
            return;
          }
          this.each(function() {
            dataUser.set(this, key, value);
          });
        }, null, value, arguments.length > 1, null, true);
      },
      removeData: function(key) {
        return this.each(function() {
          dataUser.remove(this, key);
        });
      }
    });
    jQuery.extend({
      queue: function(elem, type, data) {
        var queue;
        if (elem) {
          type = (type || "fx") + "queue";
          queue = dataPriv.get(elem, type);
          if (data) {
            if (!queue || Array.isArray(data)) {
              queue = dataPriv.access(elem, type, jQuery.makeArray(data));
            } else {
              queue.push(data);
            }
          }
          return queue || [];
        }
      },
      dequeue: function(elem, type) {
        type = type || "fx";
        var queue = jQuery.queue(elem, type), startLength = queue.length, fn = queue.shift(), hooks = jQuery._queueHooks(elem, type), next = function() {
          jQuery.dequeue(elem, type);
        };
        if (fn === "inprogress") {
          fn = queue.shift();
          startLength--;
        }
        if (fn) {
          if (type === "fx") {
            queue.unshift("inprogress");
          }
          delete hooks.stop;
          fn.call(elem, next, hooks);
        }
        if (!startLength && hooks) {
          hooks.empty.fire();
        }
      },
      _queueHooks: function(elem, type) {
        var key = type + "queueHooks";
        return dataPriv.get(elem, key) || dataPriv.access(elem, key, {
          empty: jQuery.Callbacks("once memory").add(function() {
            dataPriv.remove(elem, [type + "queue", key]);
          })
        });
      }
    });
    jQuery.fn.extend({
      queue: function(type, data) {
        var setter = 2;
        if (typeof type !== "string") {
          data = type;
          type = "fx";
          setter--;
        }
        if (arguments.length < setter) {
          return jQuery.queue(this[0], type);
        }
        return data === undefined ? this : this.each(function() {
          var queue = jQuery.queue(this, type, data);
          jQuery._queueHooks(this, type);
          if (type === "fx" && queue[0] !== "inprogress") {
            jQuery.dequeue(this, type);
          }
        });
      },
      dequeue: function(type) {
        return this.each(function() {
          jQuery.dequeue(this, type);
        });
      },
      clearQueue: function(type) {
        return this.queue(type || "fx", []);
      },
      promise: function(type, obj) {
        var tmp, count = 1, defer = jQuery.Deferred(), elements = this, i = this.length, resolve = function() {
          if (!--count) {
            defer.resolveWith(elements, [elements]);
          }
        };
        if (typeof type !== "string") {
          obj = type;
          type = undefined;
        }
        type = type || "fx";
        while (i--) {
          tmp = dataPriv.get(elements[i], type + "queueHooks");
          if (tmp && tmp.empty) {
            count++;
            tmp.empty.add(resolve);
          }
        }
        resolve();
        return defer.promise(obj);
      }
    });
    var pnum = /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source;
    var rcssNum = new RegExp("^(?:([+-])=|)(" + pnum + ")([a-z%]*)$", "i");
    var cssExpand = ["Top", "Right", "Bottom", "Left"];
    var documentElement = document2.documentElement;
    var isAttached = function(elem) {
      return jQuery.contains(elem.ownerDocument, elem);
    }, composed = { composed: true };
    if (documentElement.getRootNode) {
      isAttached = function(elem) {
        return jQuery.contains(elem.ownerDocument, elem) || elem.getRootNode(composed) === elem.ownerDocument;
      };
    }
    var isHiddenWithinTree = function(elem, el) {
      elem = el || elem;
      return elem.style.display === "none" || elem.style.display === "" && isAttached(elem) && jQuery.css(elem, "display") === "none";
    };
    function adjustCSS(elem, prop, valueParts, tween) {
      var adjusted, scale, maxIterations = 20, currentValue = tween ? function() {
        return tween.cur();
      } : function() {
        return jQuery.css(elem, prop, "");
      }, initial = currentValue(), unit = valueParts && valueParts[3] || (jQuery.cssNumber[prop] ? "" : "px"), initialInUnit = elem.nodeType && (jQuery.cssNumber[prop] || unit !== "px" && +initial) && rcssNum.exec(jQuery.css(elem, prop));
      if (initialInUnit && initialInUnit[3] !== unit) {
        initial = initial / 2;
        unit = unit || initialInUnit[3];
        initialInUnit = +initial || 1;
        while (maxIterations--) {
          jQuery.style(elem, prop, initialInUnit + unit);
          if ((1 - scale) * (1 - (scale = currentValue() / initial || 0.5)) <= 0) {
            maxIterations = 0;
          }
          initialInUnit = initialInUnit / scale;
        }
        initialInUnit = initialInUnit * 2;
        jQuery.style(elem, prop, initialInUnit + unit);
        valueParts = valueParts || [];
      }
      if (valueParts) {
        initialInUnit = +initialInUnit || +initial || 0;
        adjusted = valueParts[1] ? initialInUnit + (valueParts[1] + 1) * valueParts[2] : +valueParts[2];
        if (tween) {
          tween.unit = unit;
          tween.start = initialInUnit;
          tween.end = adjusted;
        }
      }
      return adjusted;
    }
    var defaultDisplayMap = {};
    function getDefaultDisplay(elem) {
      var temp, { ownerDocument: doc, nodeName } = elem, display = defaultDisplayMap[nodeName];
      if (display) {
        return display;
      }
      temp = doc.body.appendChild(doc.createElement(nodeName));
      display = jQuery.css(temp, "display");
      temp.parentNode.removeChild(temp);
      if (display === "none") {
        display = "block";
      }
      defaultDisplayMap[nodeName] = display;
      return display;
    }
    function showHide(elements, show) {
      var display, elem, values = [], index = 0, length = elements.length;
      for (;index < length; index++) {
        elem = elements[index];
        if (!elem.style) {
          continue;
        }
        display = elem.style.display;
        if (show) {
          if (display === "none") {
            values[index] = dataPriv.get(elem, "display") || null;
            if (!values[index]) {
              elem.style.display = "";
            }
          }
          if (elem.style.display === "" && isHiddenWithinTree(elem)) {
            values[index] = getDefaultDisplay(elem);
          }
        } else {
          if (display !== "none") {
            values[index] = "none";
            dataPriv.set(elem, "display", display);
          }
        }
      }
      for (index = 0;index < length; index++) {
        if (values[index] != null) {
          elements[index].style.display = values[index];
        }
      }
      return elements;
    }
    jQuery.fn.extend({
      show: function() {
        return showHide(this, true);
      },
      hide: function() {
        return showHide(this);
      },
      toggle: function(state) {
        if (typeof state === "boolean") {
          return state ? this.show() : this.hide();
        }
        return this.each(function() {
          if (isHiddenWithinTree(this)) {
            jQuery(this).show();
          } else {
            jQuery(this).hide();
          }
        });
      }
    });
    var rcheckableType = /^(?:checkbox|radio)$/i;
    var rtagName = /<([a-z][^\/\0>\x20\t\r\n\f]*)/i;
    var rscriptType = /^$|^module$|\/(?:java|ecma)script/i;
    (function() {
      var fragment = document2.createDocumentFragment(), div = fragment.appendChild(document2.createElement("div")), input = document2.createElement("input");
      input.setAttribute("type", "radio");
      input.setAttribute("checked", "checked");
      input.setAttribute("name", "t");
      div.appendChild(input);
      support.checkClone = div.cloneNode(true).cloneNode(true).lastChild.checked;
      div.innerHTML = "<textarea>x</textarea>";
      support.noCloneChecked = !!div.cloneNode(true).lastChild.defaultValue;
      div.innerHTML = "<option></option>";
      support.option = !!div.lastChild;
    })();
    var wrapMap = {
      thead: [1, "<table>", "</table>"],
      col: [2, "<table><colgroup>", "</colgroup></table>"],
      tr: [2, "<table><tbody>", "</tbody></table>"],
      td: [3, "<table><tbody><tr>", "</tr></tbody></table>"],
      _default: [0, "", ""]
    };
    wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
    wrapMap.th = wrapMap.td;
    if (!support.option) {
      wrapMap.optgroup = wrapMap.option = [1, "<select multiple='multiple'>", "</select>"];
    }
    function getAll(context, tag) {
      var ret;
      if (typeof context.getElementsByTagName !== "undefined") {
        ret = context.getElementsByTagName(tag || "*");
      } else if (typeof context.querySelectorAll !== "undefined") {
        ret = context.querySelectorAll(tag || "*");
      } else {
        ret = [];
      }
      if (tag === undefined || tag && nodeName(context, tag)) {
        return jQuery.merge([context], ret);
      }
      return ret;
    }
    function setGlobalEval(elems, refElements) {
      var i = 0, l = elems.length;
      for (;i < l; i++) {
        dataPriv.set(elems[i], "globalEval", !refElements || dataPriv.get(refElements[i], "globalEval"));
      }
    }
    var rhtml = /<|&#?\w+;/;
    function buildFragment(elems, context, scripts, selection, ignored) {
      var elem, tmp, tag, wrap, attached, j, fragment = context.createDocumentFragment(), nodes = [], i = 0, l = elems.length;
      for (;i < l; i++) {
        elem = elems[i];
        if (elem || elem === 0) {
          if (toType(elem) === "object") {
            jQuery.merge(nodes, elem.nodeType ? [elem] : elem);
          } else if (!rhtml.test(elem)) {
            nodes.push(context.createTextNode(elem));
          } else {
            tmp = tmp || fragment.appendChild(context.createElement("div"));
            tag = (rtagName.exec(elem) || ["", ""])[1].toLowerCase();
            wrap = wrapMap[tag] || wrapMap._default;
            tmp.innerHTML = wrap[1] + jQuery.htmlPrefilter(elem) + wrap[2];
            j = wrap[0];
            while (j--) {
              tmp = tmp.lastChild;
            }
            jQuery.merge(nodes, tmp.childNodes);
            tmp = fragment.firstChild;
            tmp.textContent = "";
          }
        }
      }
      fragment.textContent = "";
      i = 0;
      while (elem = nodes[i++]) {
        if (selection && jQuery.inArray(elem, selection) > -1) {
          if (ignored) {
            ignored.push(elem);
          }
          continue;
        }
        attached = isAttached(elem);
        tmp = getAll(fragment.appendChild(elem), "script");
        if (attached) {
          setGlobalEval(tmp);
        }
        if (scripts) {
          j = 0;
          while (elem = tmp[j++]) {
            if (rscriptType.test(elem.type || "")) {
              scripts.push(elem);
            }
          }
        }
      }
      return fragment;
    }
    var rtypenamespace = /^([^.]*)(?:\.(.+)|)/;
    function returnTrue() {
      return true;
    }
    function returnFalse() {
      return false;
    }
    function on(elem, types, selector, data, fn, one) {
      var origFn, type;
      if (typeof types === "object") {
        if (typeof selector !== "string") {
          data = data || selector;
          selector = undefined;
        }
        for (type in types) {
          on(elem, type, selector, data, types[type], one);
        }
        return elem;
      }
      if (data == null && fn == null) {
        fn = selector;
        data = selector = undefined;
      } else if (fn == null) {
        if (typeof selector === "string") {
          fn = data;
          data = undefined;
        } else {
          fn = data;
          data = selector;
          selector = undefined;
        }
      }
      if (fn === false) {
        fn = returnFalse;
      } else if (!fn) {
        return elem;
      }
      if (one === 1) {
        origFn = fn;
        fn = function(event) {
          jQuery().off(event);
          return origFn.apply(this, arguments);
        };
        fn.guid = origFn.guid || (origFn.guid = jQuery.guid++);
      }
      return elem.each(function() {
        jQuery.event.add(this, types, fn, data, selector);
      });
    }
    jQuery.event = {
      global: {},
      add: function(elem, types, handler, data, selector) {
        var handleObjIn, eventHandle, tmp, events, t, handleObj, special, handlers, type, namespaces, origType, elemData = dataPriv.get(elem);
        if (!acceptData(elem)) {
          return;
        }
        if (handler.handler) {
          handleObjIn = handler;
          handler = handleObjIn.handler;
          selector = handleObjIn.selector;
        }
        if (selector) {
          jQuery.find.matchesSelector(documentElement, selector);
        }
        if (!handler.guid) {
          handler.guid = jQuery.guid++;
        }
        if (!(events = elemData.events)) {
          events = elemData.events = Object.create(null);
        }
        if (!(eventHandle = elemData.handle)) {
          eventHandle = elemData.handle = function(e) {
            return typeof jQuery !== "undefined" && jQuery.event.triggered !== e.type ? jQuery.event.dispatch.apply(elem, arguments) : undefined;
          };
        }
        types = (types || "").match(rnothtmlwhite) || [""];
        t = types.length;
        while (t--) {
          tmp = rtypenamespace.exec(types[t]) || [];
          type = origType = tmp[1];
          namespaces = (tmp[2] || "").split(".").sort();
          if (!type) {
            continue;
          }
          special = jQuery.event.special[type] || {};
          type = (selector ? special.delegateType : special.bindType) || type;
          special = jQuery.event.special[type] || {};
          handleObj = jQuery.extend({
            type,
            origType,
            data,
            handler,
            guid: handler.guid,
            selector,
            needsContext: selector && jQuery.expr.match.needsContext.test(selector),
            namespace: namespaces.join(".")
          }, handleObjIn);
          if (!(handlers = events[type])) {
            handlers = events[type] = [];
            handlers.delegateCount = 0;
            if (!special.setup || special.setup.call(elem, data, namespaces, eventHandle) === false) {
              if (elem.addEventListener) {
                elem.addEventListener(type, eventHandle);
              }
            }
          }
          if (special.add) {
            special.add.call(elem, handleObj);
            if (!handleObj.handler.guid) {
              handleObj.handler.guid = handler.guid;
            }
          }
          if (selector) {
            handlers.splice(handlers.delegateCount++, 0, handleObj);
          } else {
            handlers.push(handleObj);
          }
          jQuery.event.global[type] = true;
        }
      },
      remove: function(elem, types, handler, selector, mappedTypes) {
        var j, origCount, tmp, events, t, handleObj, special, handlers, type, namespaces, origType, elemData = dataPriv.hasData(elem) && dataPriv.get(elem);
        if (!elemData || !(events = elemData.events)) {
          return;
        }
        types = (types || "").match(rnothtmlwhite) || [""];
        t = types.length;
        while (t--) {
          tmp = rtypenamespace.exec(types[t]) || [];
          type = origType = tmp[1];
          namespaces = (tmp[2] || "").split(".").sort();
          if (!type) {
            for (type in events) {
              jQuery.event.remove(elem, type + types[t], handler, selector, true);
            }
            continue;
          }
          special = jQuery.event.special[type] || {};
          type = (selector ? special.delegateType : special.bindType) || type;
          handlers = events[type] || [];
          tmp = tmp[2] && new RegExp("(^|\\.)" + namespaces.join("\\.(?:.*\\.|)") + "(\\.|$)");
          origCount = j = handlers.length;
          while (j--) {
            handleObj = handlers[j];
            if ((mappedTypes || origType === handleObj.origType) && (!handler || handler.guid === handleObj.guid) && (!tmp || tmp.test(handleObj.namespace)) && (!selector || selector === handleObj.selector || selector === "**" && handleObj.selector)) {
              handlers.splice(j, 1);
              if (handleObj.selector) {
                handlers.delegateCount--;
              }
              if (special.remove) {
                special.remove.call(elem, handleObj);
              }
            }
          }
          if (origCount && !handlers.length) {
            if (!special.teardown || special.teardown.call(elem, namespaces, elemData.handle) === false) {
              jQuery.removeEvent(elem, type, elemData.handle);
            }
            delete events[type];
          }
        }
        if (jQuery.isEmptyObject(events)) {
          dataPriv.remove(elem, "handle events");
        }
      },
      dispatch: function(nativeEvent) {
        var i, j, ret, matched, handleObj, handlerQueue, args = new Array(arguments.length), event = jQuery.event.fix(nativeEvent), handlers = (dataPriv.get(this, "events") || Object.create(null))[event.type] || [], special = jQuery.event.special[event.type] || {};
        args[0] = event;
        for (i = 1;i < arguments.length; i++) {
          args[i] = arguments[i];
        }
        event.delegateTarget = this;
        if (special.preDispatch && special.preDispatch.call(this, event) === false) {
          return;
        }
        handlerQueue = jQuery.event.handlers.call(this, event, handlers);
        i = 0;
        while ((matched = handlerQueue[i++]) && !event.isPropagationStopped()) {
          event.currentTarget = matched.elem;
          j = 0;
          while ((handleObj = matched.handlers[j++]) && !event.isImmediatePropagationStopped()) {
            if (!event.rnamespace || handleObj.namespace === false || event.rnamespace.test(handleObj.namespace)) {
              event.handleObj = handleObj;
              event.data = handleObj.data;
              ret = ((jQuery.event.special[handleObj.origType] || {}).handle || handleObj.handler).apply(matched.elem, args);
              if (ret !== undefined) {
                if ((event.result = ret) === false) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }
            }
          }
        }
        if (special.postDispatch) {
          special.postDispatch.call(this, event);
        }
        return event.result;
      },
      handlers: function(event, handlers) {
        var i, handleObj, sel, matchedHandlers, matchedSelectors, handlerQueue = [], delegateCount = handlers.delegateCount, cur = event.target;
        if (delegateCount && cur.nodeType && !(event.type === "click" && event.button >= 1)) {
          for (;cur !== this; cur = cur.parentNode || this) {
            if (cur.nodeType === 1 && !(event.type === "click" && cur.disabled === true)) {
              matchedHandlers = [];
              matchedSelectors = {};
              for (i = 0;i < delegateCount; i++) {
                handleObj = handlers[i];
                sel = handleObj.selector + " ";
                if (matchedSelectors[sel] === undefined) {
                  matchedSelectors[sel] = handleObj.needsContext ? jQuery(sel, this).index(cur) > -1 : jQuery.find(sel, this, null, [cur]).length;
                }
                if (matchedSelectors[sel]) {
                  matchedHandlers.push(handleObj);
                }
              }
              if (matchedHandlers.length) {
                handlerQueue.push({ elem: cur, handlers: matchedHandlers });
              }
            }
          }
        }
        cur = this;
        if (delegateCount < handlers.length) {
          handlerQueue.push({ elem: cur, handlers: handlers.slice(delegateCount) });
        }
        return handlerQueue;
      },
      addProp: function(name, hook) {
        Object.defineProperty(jQuery.Event.prototype, name, {
          enumerable: true,
          configurable: true,
          get: isFunction(hook) ? function() {
            if (this.originalEvent) {
              return hook(this.originalEvent);
            }
          } : function() {
            if (this.originalEvent) {
              return this.originalEvent[name];
            }
          },
          set: function(value) {
            Object.defineProperty(this, name, {
              enumerable: true,
              configurable: true,
              writable: true,
              value
            });
          }
        });
      },
      fix: function(originalEvent) {
        return originalEvent[jQuery.expando] ? originalEvent : new jQuery.Event(originalEvent);
      },
      special: {
        load: {
          noBubble: true
        },
        click: {
          setup: function(data) {
            var el = this || data;
            if (rcheckableType.test(el.type) && el.click && nodeName(el, "input")) {
              leverageNative(el, "click", true);
            }
            return false;
          },
          trigger: function(data) {
            var el = this || data;
            if (rcheckableType.test(el.type) && el.click && nodeName(el, "input")) {
              leverageNative(el, "click");
            }
            return true;
          },
          _default: function(event) {
            var target = event.target;
            return rcheckableType.test(target.type) && target.click && nodeName(target, "input") && dataPriv.get(target, "click") || nodeName(target, "a");
          }
        },
        beforeunload: {
          postDispatch: function(event) {
            if (event.result !== undefined && event.originalEvent) {
              event.originalEvent.returnValue = event.result;
            }
          }
        }
      }
    };
    function leverageNative(el, type, isSetup) {
      if (!isSetup) {
        if (dataPriv.get(el, type) === undefined) {
          jQuery.event.add(el, type, returnTrue);
        }
        return;
      }
      dataPriv.set(el, type, false);
      jQuery.event.add(el, type, {
        namespace: false,
        handler: function(event) {
          var result, saved = dataPriv.get(this, type);
          if (event.isTrigger & 1 && this[type]) {
            if (!saved) {
              saved = slice.call(arguments);
              dataPriv.set(this, type, saved);
              this[type]();
              result = dataPriv.get(this, type);
              dataPriv.set(this, type, false);
              if (saved !== result) {
                event.stopImmediatePropagation();
                event.preventDefault();
                return result;
              }
            } else if ((jQuery.event.special[type] || {}).delegateType) {
              event.stopPropagation();
            }
          } else if (saved) {
            dataPriv.set(this, type, jQuery.event.trigger(saved[0], saved.slice(1), this));
            event.stopPropagation();
            event.isImmediatePropagationStopped = returnTrue;
          }
        }
      });
    }
    jQuery.removeEvent = function(elem, type, handle) {
      if (elem.removeEventListener) {
        elem.removeEventListener(type, handle);
      }
    };
    jQuery.Event = function(src, props) {
      if (!(this instanceof jQuery.Event)) {
        return new jQuery.Event(src, props);
      }
      if (src && src.type) {
        this.originalEvent = src;
        this.type = src.type;
        this.isDefaultPrevented = src.defaultPrevented || src.defaultPrevented === undefined && src.returnValue === false ? returnTrue : returnFalse;
        this.target = src.target && src.target.nodeType === 3 ? src.target.parentNode : src.target;
        this.currentTarget = src.currentTarget;
        this.relatedTarget = src.relatedTarget;
      } else {
        this.type = src;
      }
      if (props) {
        jQuery.extend(this, props);
      }
      this.timeStamp = src && src.timeStamp || Date.now();
      this[jQuery.expando] = true;
    };
    jQuery.Event.prototype = {
      constructor: jQuery.Event,
      isDefaultPrevented: returnFalse,
      isPropagationStopped: returnFalse,
      isImmediatePropagationStopped: returnFalse,
      isSimulated: false,
      preventDefault: function() {
        var e = this.originalEvent;
        this.isDefaultPrevented = returnTrue;
        if (e && !this.isSimulated) {
          e.preventDefault();
        }
      },
      stopPropagation: function() {
        var e = this.originalEvent;
        this.isPropagationStopped = returnTrue;
        if (e && !this.isSimulated) {
          e.stopPropagation();
        }
      },
      stopImmediatePropagation: function() {
        var e = this.originalEvent;
        this.isImmediatePropagationStopped = returnTrue;
        if (e && !this.isSimulated) {
          e.stopImmediatePropagation();
        }
        this.stopPropagation();
      }
    };
    jQuery.each({
      altKey: true,
      bubbles: true,
      cancelable: true,
      changedTouches: true,
      ctrlKey: true,
      detail: true,
      eventPhase: true,
      metaKey: true,
      pageX: true,
      pageY: true,
      shiftKey: true,
      view: true,
      char: true,
      code: true,
      charCode: true,
      key: true,
      keyCode: true,
      button: true,
      buttons: true,
      clientX: true,
      clientY: true,
      offsetX: true,
      offsetY: true,
      pointerId: true,
      pointerType: true,
      screenX: true,
      screenY: true,
      targetTouches: true,
      toElement: true,
      touches: true,
      which: true
    }, jQuery.event.addProp);
    jQuery.each({ focus: "focusin", blur: "focusout" }, function(type, delegateType) {
      function focusMappedHandler(nativeEvent) {
        if (document2.documentMode) {
          var handle = dataPriv.get(this, "handle"), event = jQuery.event.fix(nativeEvent);
          event.type = nativeEvent.type === "focusin" ? "focus" : "blur";
          event.isSimulated = true;
          handle(nativeEvent);
          if (event.target === event.currentTarget) {
            handle(event);
          }
        } else {
          jQuery.event.simulate(delegateType, nativeEvent.target, jQuery.event.fix(nativeEvent));
        }
      }
      jQuery.event.special[type] = {
        setup: function() {
          var attaches;
          leverageNative(this, type, true);
          if (document2.documentMode) {
            attaches = dataPriv.get(this, delegateType);
            if (!attaches) {
              this.addEventListener(delegateType, focusMappedHandler);
            }
            dataPriv.set(this, delegateType, (attaches || 0) + 1);
          } else {
            return false;
          }
        },
        trigger: function() {
          leverageNative(this, type);
          return true;
        },
        teardown: function() {
          var attaches;
          if (document2.documentMode) {
            attaches = dataPriv.get(this, delegateType) - 1;
            if (!attaches) {
              this.removeEventListener(delegateType, focusMappedHandler);
              dataPriv.remove(this, delegateType);
            } else {
              dataPriv.set(this, delegateType, attaches);
            }
          } else {
            return false;
          }
        },
        _default: function(event) {
          return dataPriv.get(event.target, type);
        },
        delegateType
      };
      jQuery.event.special[delegateType] = {
        setup: function() {
          var doc = this.ownerDocument || this.document || this, dataHolder = document2.documentMode ? this : doc, attaches = dataPriv.get(dataHolder, delegateType);
          if (!attaches) {
            if (document2.documentMode) {
              this.addEventListener(delegateType, focusMappedHandler);
            } else {
              doc.addEventListener(type, focusMappedHandler, true);
            }
          }
          dataPriv.set(dataHolder, delegateType, (attaches || 0) + 1);
        },
        teardown: function() {
          var doc = this.ownerDocument || this.document || this, dataHolder = document2.documentMode ? this : doc, attaches = dataPriv.get(dataHolder, delegateType) - 1;
          if (!attaches) {
            if (document2.documentMode) {
              this.removeEventListener(delegateType, focusMappedHandler);
            } else {
              doc.removeEventListener(type, focusMappedHandler, true);
            }
            dataPriv.remove(dataHolder, delegateType);
          } else {
            dataPriv.set(dataHolder, delegateType, attaches);
          }
        }
      };
    });
    jQuery.each({
      mouseenter: "mouseover",
      mouseleave: "mouseout",
      pointerenter: "pointerover",
      pointerleave: "pointerout"
    }, function(orig, fix) {
      jQuery.event.special[orig] = {
        delegateType: fix,
        bindType: fix,
        handle: function(event) {
          var ret, target = this, { relatedTarget: related, handleObj } = event;
          if (!related || related !== target && !jQuery.contains(target, related)) {
            event.type = handleObj.origType;
            ret = handleObj.handler.apply(this, arguments);
            event.type = fix;
          }
          return ret;
        }
      };
    });
    jQuery.fn.extend({
      on: function(types, selector, data, fn) {
        return on(this, types, selector, data, fn);
      },
      one: function(types, selector, data, fn) {
        return on(this, types, selector, data, fn, 1);
      },
      off: function(types, selector, fn) {
        var handleObj, type;
        if (types && types.preventDefault && types.handleObj) {
          handleObj = types.handleObj;
          jQuery(types.delegateTarget).off(handleObj.namespace ? handleObj.origType + "." + handleObj.namespace : handleObj.origType, handleObj.selector, handleObj.handler);
          return this;
        }
        if (typeof types === "object") {
          for (type in types) {
            this.off(type, selector, types[type]);
          }
          return this;
        }
        if (selector === false || typeof selector === "function") {
          fn = selector;
          selector = undefined;
        }
        if (fn === false) {
          fn = returnFalse;
        }
        return this.each(function() {
          jQuery.event.remove(this, types, fn, selector);
        });
      }
    });
    var rnoInnerhtml = /<script|<style|<link/i, rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i, rcleanScript = /^\s*<!\[CDATA\[|\]\]>\s*$/g;
    function manipulationTarget(elem, content) {
      if (nodeName(elem, "table") && nodeName(content.nodeType !== 11 ? content : content.firstChild, "tr")) {
        return jQuery(elem).children("tbody")[0] || elem;
      }
      return elem;
    }
    function disableScript(elem) {
      elem.type = (elem.getAttribute("type") !== null) + "/" + elem.type;
      return elem;
    }
    function restoreScript(elem) {
      if ((elem.type || "").slice(0, 5) === "true/") {
        elem.type = elem.type.slice(5);
      } else {
        elem.removeAttribute("type");
      }
      return elem;
    }
    function cloneCopyEvent(src, dest) {
      var i, l, type, pdataOld, udataOld, udataCur, events;
      if (dest.nodeType !== 1) {
        return;
      }
      if (dataPriv.hasData(src)) {
        pdataOld = dataPriv.get(src);
        events = pdataOld.events;
        if (events) {
          dataPriv.remove(dest, "handle events");
          for (type in events) {
            for (i = 0, l = events[type].length;i < l; i++) {
              jQuery.event.add(dest, type, events[type][i]);
            }
          }
        }
      }
      if (dataUser.hasData(src)) {
        udataOld = dataUser.access(src);
        udataCur = jQuery.extend({}, udataOld);
        dataUser.set(dest, udataCur);
      }
    }
    function fixInput(src, dest) {
      var nodeName = dest.nodeName.toLowerCase();
      if (nodeName === "input" && rcheckableType.test(src.type)) {
        dest.checked = src.checked;
      } else if (nodeName === "input" || nodeName === "textarea") {
        dest.defaultValue = src.defaultValue;
      }
    }
    function domManip(collection, args, callback, ignored) {
      args = flat(args);
      var fragment, first, scripts, hasScripts, node, doc, i = 0, l = collection.length, iNoClone = l - 1, value = args[0], valueIsFunction = isFunction(value);
      if (valueIsFunction || l > 1 && typeof value === "string" && !support.checkClone && rchecked.test(value)) {
        return collection.each(function(index) {
          var self = collection.eq(index);
          if (valueIsFunction) {
            args[0] = value.call(this, index, self.html());
          }
          domManip(self, args, callback, ignored);
        });
      }
      if (l) {
        fragment = buildFragment(args, collection[0].ownerDocument, false, collection, ignored);
        first = fragment.firstChild;
        if (fragment.childNodes.length === 1) {
          fragment = first;
        }
        if (first || ignored) {
          scripts = jQuery.map(getAll(fragment, "script"), disableScript);
          hasScripts = scripts.length;
          for (;i < l; i++) {
            node = fragment;
            if (i !== iNoClone) {
              node = jQuery.clone(node, true, true);
              if (hasScripts) {
                jQuery.merge(scripts, getAll(node, "script"));
              }
            }
            callback.call(collection[i], node, i);
          }
          if (hasScripts) {
            doc = scripts[scripts.length - 1].ownerDocument;
            jQuery.map(scripts, restoreScript);
            for (i = 0;i < hasScripts; i++) {
              node = scripts[i];
              if (rscriptType.test(node.type || "") && !dataPriv.access(node, "globalEval") && jQuery.contains(doc, node)) {
                if (node.src && (node.type || "").toLowerCase() !== "module") {
                  if (jQuery._evalUrl && !node.noModule) {
                    jQuery._evalUrl(node.src, {
                      nonce: node.nonce || node.getAttribute("nonce")
                    }, doc);
                  }
                } else {
                  DOMEval(node.textContent.replace(rcleanScript, ""), node, doc);
                }
              }
            }
          }
        }
      }
      return collection;
    }
    function remove(elem, selector, keepData) {
      var node, nodes = selector ? jQuery.filter(selector, elem) : elem, i = 0;
      for (;(node = nodes[i]) != null; i++) {
        if (!keepData && node.nodeType === 1) {
          jQuery.cleanData(getAll(node));
        }
        if (node.parentNode) {
          if (keepData && isAttached(node)) {
            setGlobalEval(getAll(node, "script"));
          }
          node.parentNode.removeChild(node);
        }
      }
      return elem;
    }
    jQuery.extend({
      htmlPrefilter: function(html) {
        return html;
      },
      clone: function(elem, dataAndEvents, deepDataAndEvents) {
        var i, l, srcElements, destElements, clone = elem.cloneNode(true), inPage = isAttached(elem);
        if (!support.noCloneChecked && (elem.nodeType === 1 || elem.nodeType === 11) && !jQuery.isXMLDoc(elem)) {
          destElements = getAll(clone);
          srcElements = getAll(elem);
          for (i = 0, l = srcElements.length;i < l; i++) {
            fixInput(srcElements[i], destElements[i]);
          }
        }
        if (dataAndEvents) {
          if (deepDataAndEvents) {
            srcElements = srcElements || getAll(elem);
            destElements = destElements || getAll(clone);
            for (i = 0, l = srcElements.length;i < l; i++) {
              cloneCopyEvent(srcElements[i], destElements[i]);
            }
          } else {
            cloneCopyEvent(elem, clone);
          }
        }
        destElements = getAll(clone, "script");
        if (destElements.length > 0) {
          setGlobalEval(destElements, !inPage && getAll(elem, "script"));
        }
        return clone;
      },
      cleanData: function(elems) {
        var data, elem, type, special = jQuery.event.special, i = 0;
        for (;(elem = elems[i]) !== undefined; i++) {
          if (acceptData(elem)) {
            if (data = elem[dataPriv.expando]) {
              if (data.events) {
                for (type in data.events) {
                  if (special[type]) {
                    jQuery.event.remove(elem, type);
                  } else {
                    jQuery.removeEvent(elem, type, data.handle);
                  }
                }
              }
              elem[dataPriv.expando] = undefined;
            }
            if (elem[dataUser.expando]) {
              elem[dataUser.expando] = undefined;
            }
          }
        }
      }
    });
    jQuery.fn.extend({
      detach: function(selector) {
        return remove(this, selector, true);
      },
      remove: function(selector) {
        return remove(this, selector);
      },
      text: function(value) {
        return access(this, function(value) {
          return value === undefined ? jQuery.text(this) : this.empty().each(function() {
            if (this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9) {
              this.textContent = value;
            }
          });
        }, null, value, arguments.length);
      },
      append: function() {
        return domManip(this, arguments, function(elem) {
          if (this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9) {
            var target = manipulationTarget(this, elem);
            target.appendChild(elem);
          }
        });
      },
      prepend: function() {
        return domManip(this, arguments, function(elem) {
          if (this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9) {
            var target = manipulationTarget(this, elem);
            target.insertBefore(elem, target.firstChild);
          }
        });
      },
      before: function() {
        return domManip(this, arguments, function(elem) {
          if (this.parentNode) {
            this.parentNode.insertBefore(elem, this);
          }
        });
      },
      after: function() {
        return domManip(this, arguments, function(elem) {
          if (this.parentNode) {
            this.parentNode.insertBefore(elem, this.nextSibling);
          }
        });
      },
      empty: function() {
        var elem, i = 0;
        for (;(elem = this[i]) != null; i++) {
          if (elem.nodeType === 1) {
            jQuery.cleanData(getAll(elem, false));
            elem.textContent = "";
          }
        }
        return this;
      },
      clone: function(dataAndEvents, deepDataAndEvents) {
        dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
        deepDataAndEvents = deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;
        return this.map(function() {
          return jQuery.clone(this, dataAndEvents, deepDataAndEvents);
        });
      },
      html: function(value) {
        return access(this, function(value) {
          var elem = this[0] || {}, i = 0, l = this.length;
          if (value === undefined && elem.nodeType === 1) {
            return elem.innerHTML;
          }
          if (typeof value === "string" && !rnoInnerhtml.test(value) && !wrapMap[(rtagName.exec(value) || ["", ""])[1].toLowerCase()]) {
            value = jQuery.htmlPrefilter(value);
            try {
              for (;i < l; i++) {
                elem = this[i] || {};
                if (elem.nodeType === 1) {
                  jQuery.cleanData(getAll(elem, false));
                  elem.innerHTML = value;
                }
              }
              elem = 0;
            } catch (e) {}
          }
          if (elem) {
            this.empty().append(value);
          }
        }, null, value, arguments.length);
      },
      replaceWith: function() {
        var ignored = [];
        return domManip(this, arguments, function(elem) {
          var parent = this.parentNode;
          if (jQuery.inArray(this, ignored) < 0) {
            jQuery.cleanData(getAll(this));
            if (parent) {
              parent.replaceChild(elem, this);
            }
          }
        }, ignored);
      }
    });
    jQuery.each({
      appendTo: "append",
      prependTo: "prepend",
      insertBefore: "before",
      insertAfter: "after",
      replaceAll: "replaceWith"
    }, function(name, original) {
      jQuery.fn[name] = function(selector) {
        var elems, ret = [], insert = jQuery(selector), last = insert.length - 1, i = 0;
        for (;i <= last; i++) {
          elems = i === last ? this : this.clone(true);
          jQuery(insert[i])[original](elems);
          push.apply(ret, elems.get());
        }
        return this.pushStack(ret);
      };
    });
    var rnumnonpx = new RegExp("^(" + pnum + ")(?!px)[a-z%]+$", "i");
    var rcustomProp = /^--/;
    var getStyles = function(elem) {
      var view = elem.ownerDocument.defaultView;
      if (!view || !view.opener) {
        view = window2;
      }
      return view.getComputedStyle(elem);
    };
    var swap = function(elem, options, callback) {
      var ret, name, old = {};
      for (name in options) {
        old[name] = elem.style[name];
        elem.style[name] = options[name];
      }
      ret = callback.call(elem);
      for (name in options) {
        elem.style[name] = old[name];
      }
      return ret;
    };
    var rboxStyle = new RegExp(cssExpand.join("|"), "i");
    (function() {
      function computeStyleTests() {
        if (!div) {
          return;
        }
        container.style.cssText = "position:absolute;left:-11111px;width:60px;" + "margin-top:1px;padding:0;border:0";
        div.style.cssText = "position:relative;display:block;box-sizing:border-box;overflow:scroll;" + "margin:auto;border:1px;padding:1px;" + "width:60%;top:1%";
        documentElement.appendChild(container).appendChild(div);
        var divStyle = window2.getComputedStyle(div);
        pixelPositionVal = divStyle.top !== "1%";
        reliableMarginLeftVal = roundPixelMeasures(divStyle.marginLeft) === 12;
        div.style.right = "60%";
        pixelBoxStylesVal = roundPixelMeasures(divStyle.right) === 36;
        boxSizingReliableVal = roundPixelMeasures(divStyle.width) === 36;
        div.style.position = "absolute";
        scrollboxSizeVal = roundPixelMeasures(div.offsetWidth / 3) === 12;
        documentElement.removeChild(container);
        div = null;
      }
      function roundPixelMeasures(measure) {
        return Math.round(parseFloat(measure));
      }
      var pixelPositionVal, boxSizingReliableVal, scrollboxSizeVal, pixelBoxStylesVal, reliableTrDimensionsVal, reliableMarginLeftVal, container = document2.createElement("div"), div = document2.createElement("div");
      if (!div.style) {
        return;
      }
      div.style.backgroundClip = "content-box";
      div.cloneNode(true).style.backgroundClip = "";
      support.clearCloneStyle = div.style.backgroundClip === "content-box";
      jQuery.extend(support, {
        boxSizingReliable: function() {
          computeStyleTests();
          return boxSizingReliableVal;
        },
        pixelBoxStyles: function() {
          computeStyleTests();
          return pixelBoxStylesVal;
        },
        pixelPosition: function() {
          computeStyleTests();
          return pixelPositionVal;
        },
        reliableMarginLeft: function() {
          computeStyleTests();
          return reliableMarginLeftVal;
        },
        scrollboxSize: function() {
          computeStyleTests();
          return scrollboxSizeVal;
        },
        reliableTrDimensions: function() {
          var table, tr, trChild, trStyle;
          if (reliableTrDimensionsVal == null) {
            table = document2.createElement("table");
            tr = document2.createElement("tr");
            trChild = document2.createElement("div");
            table.style.cssText = "position:absolute;left:-11111px;border-collapse:separate";
            tr.style.cssText = "box-sizing:content-box;border:1px solid";
            tr.style.height = "1px";
            trChild.style.height = "9px";
            trChild.style.display = "block";
            documentElement.appendChild(table).appendChild(tr).appendChild(trChild);
            trStyle = window2.getComputedStyle(tr);
            reliableTrDimensionsVal = parseInt(trStyle.height, 10) + parseInt(trStyle.borderTopWidth, 10) + parseInt(trStyle.borderBottomWidth, 10) === tr.offsetHeight;
            documentElement.removeChild(table);
          }
          return reliableTrDimensionsVal;
        }
      });
    })();
    function curCSS(elem, name, computed) {
      var width, minWidth, maxWidth, ret, isCustomProp = rcustomProp.test(name), style = elem.style;
      computed = computed || getStyles(elem);
      if (computed) {
        ret = computed.getPropertyValue(name) || computed[name];
        if (isCustomProp && ret) {
          ret = ret.replace(rtrimCSS, "$1") || undefined;
        }
        if (ret === "" && !isAttached(elem)) {
          ret = jQuery.style(elem, name);
        }
        if (!support.pixelBoxStyles() && rnumnonpx.test(ret) && rboxStyle.test(name)) {
          width = style.width;
          minWidth = style.minWidth;
          maxWidth = style.maxWidth;
          style.minWidth = style.maxWidth = style.width = ret;
          ret = computed.width;
          style.width = width;
          style.minWidth = minWidth;
          style.maxWidth = maxWidth;
        }
      }
      return ret !== undefined ? ret + "" : ret;
    }
    function addGetHookIf(conditionFn, hookFn) {
      return {
        get: function() {
          if (conditionFn()) {
            delete this.get;
            return;
          }
          return (this.get = hookFn).apply(this, arguments);
        }
      };
    }
    var cssPrefixes = ["Webkit", "Moz", "ms"], emptyStyle = document2.createElement("div").style, vendorProps = {};
    function vendorPropName(name) {
      var capName = name[0].toUpperCase() + name.slice(1), i = cssPrefixes.length;
      while (i--) {
        name = cssPrefixes[i] + capName;
        if (name in emptyStyle) {
          return name;
        }
      }
    }
    function finalPropName(name) {
      var final = jQuery.cssProps[name] || vendorProps[name];
      if (final) {
        return final;
      }
      if (name in emptyStyle) {
        return name;
      }
      return vendorProps[name] = vendorPropName(name) || name;
    }
    var rdisplayswap = /^(none|table(?!-c[ea]).+)/, cssShow = { position: "absolute", visibility: "hidden", display: "block" }, cssNormalTransform = {
      letterSpacing: "0",
      fontWeight: "400"
    };
    function setPositiveNumber(_elem, value, subtract) {
      var matches = rcssNum.exec(value);
      return matches ? Math.max(0, matches[2] - (subtract || 0)) + (matches[3] || "px") : value;
    }
    function boxModelAdjustment(elem, dimension, box, isBorderBox, styles, computedVal) {
      var i = dimension === "width" ? 1 : 0, extra = 0, delta = 0, marginDelta = 0;
      if (box === (isBorderBox ? "border" : "content")) {
        return 0;
      }
      for (;i < 4; i += 2) {
        if (box === "margin") {
          marginDelta += jQuery.css(elem, box + cssExpand[i], true, styles);
        }
        if (!isBorderBox) {
          delta += jQuery.css(elem, "padding" + cssExpand[i], true, styles);
          if (box !== "padding") {
            delta += jQuery.css(elem, "border" + cssExpand[i] + "Width", true, styles);
          } else {
            extra += jQuery.css(elem, "border" + cssExpand[i] + "Width", true, styles);
          }
        } else {
          if (box === "content") {
            delta -= jQuery.css(elem, "padding" + cssExpand[i], true, styles);
          }
          if (box !== "margin") {
            delta -= jQuery.css(elem, "border" + cssExpand[i] + "Width", true, styles);
          }
        }
      }
      if (!isBorderBox && computedVal >= 0) {
        delta += Math.max(0, Math.ceil(elem["offset" + dimension[0].toUpperCase() + dimension.slice(1)] - computedVal - delta - extra - 0.5)) || 0;
      }
      return delta + marginDelta;
    }
    function getWidthOrHeight(elem, dimension, extra) {
      var styles = getStyles(elem), boxSizingNeeded = !support.boxSizingReliable() || extra, isBorderBox = boxSizingNeeded && jQuery.css(elem, "boxSizing", false, styles) === "border-box", valueIsBorderBox = isBorderBox, val = curCSS(elem, dimension, styles), offsetProp = "offset" + dimension[0].toUpperCase() + dimension.slice(1);
      if (rnumnonpx.test(val)) {
        if (!extra) {
          return val;
        }
        val = "auto";
      }
      if ((!support.boxSizingReliable() && isBorderBox || !support.reliableTrDimensions() && nodeName(elem, "tr") || val === "auto" || !parseFloat(val) && jQuery.css(elem, "display", false, styles) === "inline") && elem.getClientRects().length) {
        isBorderBox = jQuery.css(elem, "boxSizing", false, styles) === "border-box";
        valueIsBorderBox = offsetProp in elem;
        if (valueIsBorderBox) {
          val = elem[offsetProp];
        }
      }
      val = parseFloat(val) || 0;
      return val + boxModelAdjustment(elem, dimension, extra || (isBorderBox ? "border" : "content"), valueIsBorderBox, styles, val) + "px";
    }
    jQuery.extend({
      cssHooks: {
        opacity: {
          get: function(elem, computed) {
            if (computed) {
              var ret = curCSS(elem, "opacity");
              return ret === "" ? "1" : ret;
            }
          }
        }
      },
      cssNumber: {
        animationIterationCount: true,
        aspectRatio: true,
        borderImageSlice: true,
        columnCount: true,
        flexGrow: true,
        flexShrink: true,
        fontWeight: true,
        gridArea: true,
        gridColumn: true,
        gridColumnEnd: true,
        gridColumnStart: true,
        gridRow: true,
        gridRowEnd: true,
        gridRowStart: true,
        lineHeight: true,
        opacity: true,
        order: true,
        orphans: true,
        scale: true,
        widows: true,
        zIndex: true,
        zoom: true,
        fillOpacity: true,
        floodOpacity: true,
        stopOpacity: true,
        strokeMiterlimit: true,
        strokeOpacity: true
      },
      cssProps: {},
      style: function(elem, name, value, extra) {
        if (!elem || elem.nodeType === 3 || elem.nodeType === 8 || !elem.style) {
          return;
        }
        var ret, type, hooks, origName = camelCase(name), isCustomProp = rcustomProp.test(name), style = elem.style;
        if (!isCustomProp) {
          name = finalPropName(origName);
        }
        hooks = jQuery.cssHooks[name] || jQuery.cssHooks[origName];
        if (value !== undefined) {
          type = typeof value;
          if (type === "string" && (ret = rcssNum.exec(value)) && ret[1]) {
            value = adjustCSS(elem, name, ret);
            type = "number";
          }
          if (value == null || value !== value) {
            return;
          }
          if (type === "number" && !isCustomProp) {
            value += ret && ret[3] || (jQuery.cssNumber[origName] ? "" : "px");
          }
          if (!support.clearCloneStyle && value === "" && name.indexOf("background") === 0) {
            style[name] = "inherit";
          }
          if (!hooks || !("set" in hooks) || (value = hooks.set(elem, value, extra)) !== undefined) {
            if (isCustomProp) {
              style.setProperty(name, value);
            } else {
              style[name] = value;
            }
          }
        } else {
          if (hooks && "get" in hooks && (ret = hooks.get(elem, false, extra)) !== undefined) {
            return ret;
          }
          return style[name];
        }
      },
      css: function(elem, name, extra, styles) {
        var val, num, hooks, origName = camelCase(name), isCustomProp = rcustomProp.test(name);
        if (!isCustomProp) {
          name = finalPropName(origName);
        }
        hooks = jQuery.cssHooks[name] || jQuery.cssHooks[origName];
        if (hooks && "get" in hooks) {
          val = hooks.get(elem, true, extra);
        }
        if (val === undefined) {
          val = curCSS(elem, name, styles);
        }
        if (val === "normal" && name in cssNormalTransform) {
          val = cssNormalTransform[name];
        }
        if (extra === "" || extra) {
          num = parseFloat(val);
          return extra === true || isFinite(num) ? num || 0 : val;
        }
        return val;
      }
    });
    jQuery.each(["height", "width"], function(_i, dimension) {
      jQuery.cssHooks[dimension] = {
        get: function(elem, computed, extra) {
          if (computed) {
            return rdisplayswap.test(jQuery.css(elem, "display")) && (!elem.getClientRects().length || !elem.getBoundingClientRect().width) ? swap(elem, cssShow, function() {
              return getWidthOrHeight(elem, dimension, extra);
            }) : getWidthOrHeight(elem, dimension, extra);
          }
        },
        set: function(elem, value, extra) {
          var matches, styles = getStyles(elem), scrollboxSizeBuggy = !support.scrollboxSize() && styles.position === "absolute", boxSizingNeeded = scrollboxSizeBuggy || extra, isBorderBox = boxSizingNeeded && jQuery.css(elem, "boxSizing", false, styles) === "border-box", subtract = extra ? boxModelAdjustment(elem, dimension, extra, isBorderBox, styles) : 0;
          if (isBorderBox && scrollboxSizeBuggy) {
            subtract -= Math.ceil(elem["offset" + dimension[0].toUpperCase() + dimension.slice(1)] - parseFloat(styles[dimension]) - boxModelAdjustment(elem, dimension, "border", false, styles) - 0.5);
          }
          if (subtract && (matches = rcssNum.exec(value)) && (matches[3] || "px") !== "px") {
            elem.style[dimension] = value;
            value = jQuery.css(elem, dimension);
          }
          return setPositiveNumber(elem, value, subtract);
        }
      };
    });
    jQuery.cssHooks.marginLeft = addGetHookIf(support.reliableMarginLeft, function(elem, computed) {
      if (computed) {
        return (parseFloat(curCSS(elem, "marginLeft")) || elem.getBoundingClientRect().left - swap(elem, { marginLeft: 0 }, function() {
          return elem.getBoundingClientRect().left;
        })) + "px";
      }
    });
    jQuery.each({
      margin: "",
      padding: "",
      border: "Width"
    }, function(prefix, suffix) {
      jQuery.cssHooks[prefix + suffix] = {
        expand: function(value) {
          var i = 0, expanded = {}, parts = typeof value === "string" ? value.split(" ") : [value];
          for (;i < 4; i++) {
            expanded[prefix + cssExpand[i] + suffix] = parts[i] || parts[i - 2] || parts[0];
          }
          return expanded;
        }
      };
      if (prefix !== "margin") {
        jQuery.cssHooks[prefix + suffix].set = setPositiveNumber;
      }
    });
    jQuery.fn.extend({
      css: function(name, value) {
        return access(this, function(elem, name, value) {
          var styles, len, map = {}, i = 0;
          if (Array.isArray(name)) {
            styles = getStyles(elem);
            len = name.length;
            for (;i < len; i++) {
              map[name[i]] = jQuery.css(elem, name[i], false, styles);
            }
            return map;
          }
          return value !== undefined ? jQuery.style(elem, name, value) : jQuery.css(elem, name);
        }, name, value, arguments.length > 1);
      }
    });
    function Tween(elem, options, prop, end, easing) {
      return new Tween.prototype.init(elem, options, prop, end, easing);
    }
    jQuery.Tween = Tween;
    Tween.prototype = {
      constructor: Tween,
      init: function(elem, options, prop, end, easing, unit) {
        this.elem = elem;
        this.prop = prop;
        this.easing = easing || jQuery.easing._default;
        this.options = options;
        this.start = this.now = this.cur();
        this.end = end;
        this.unit = unit || (jQuery.cssNumber[prop] ? "" : "px");
      },
      cur: function() {
        var hooks = Tween.propHooks[this.prop];
        return hooks && hooks.get ? hooks.get(this) : Tween.propHooks._default.get(this);
      },
      run: function(percent) {
        var eased, hooks = Tween.propHooks[this.prop];
        if (this.options.duration) {
          this.pos = eased = jQuery.easing[this.easing](percent, this.options.duration * percent, 0, 1, this.options.duration);
        } else {
          this.pos = eased = percent;
        }
        this.now = (this.end - this.start) * eased + this.start;
        if (this.options.step) {
          this.options.step.call(this.elem, this.now, this);
        }
        if (hooks && hooks.set) {
          hooks.set(this);
        } else {
          Tween.propHooks._default.set(this);
        }
        return this;
      }
    };
    Tween.prototype.init.prototype = Tween.prototype;
    Tween.propHooks = {
      _default: {
        get: function(tween) {
          var result;
          if (tween.elem.nodeType !== 1 || tween.elem[tween.prop] != null && tween.elem.style[tween.prop] == null) {
            return tween.elem[tween.prop];
          }
          result = jQuery.css(tween.elem, tween.prop, "");
          return !result || result === "auto" ? 0 : result;
        },
        set: function(tween) {
          if (jQuery.fx.step[tween.prop]) {
            jQuery.fx.step[tween.prop](tween);
          } else if (tween.elem.nodeType === 1 && (jQuery.cssHooks[tween.prop] || tween.elem.style[finalPropName(tween.prop)] != null)) {
            jQuery.style(tween.elem, tween.prop, tween.now + tween.unit);
          } else {
            tween.elem[tween.prop] = tween.now;
          }
        }
      }
    };
    Tween.propHooks.scrollTop = Tween.propHooks.scrollLeft = {
      set: function(tween) {
        if (tween.elem.nodeType && tween.elem.parentNode) {
          tween.elem[tween.prop] = tween.now;
        }
      }
    };
    jQuery.easing = {
      linear: function(p) {
        return p;
      },
      swing: function(p) {
        return 0.5 - Math.cos(p * Math.PI) / 2;
      },
      _default: "swing"
    };
    jQuery.fx = Tween.prototype.init;
    jQuery.fx.step = {};
    var fxNow, inProgress, rfxtypes = /^(?:toggle|show|hide)$/, rrun = /queueHooks$/;
    function schedule() {
      if (inProgress) {
        if (document2.hidden === false && window2.requestAnimationFrame) {
          window2.requestAnimationFrame(schedule);
        } else {
          window2.setTimeout(schedule, jQuery.fx.interval);
        }
        jQuery.fx.tick();
      }
    }
    function createFxNow() {
      window2.setTimeout(function() {
        fxNow = undefined;
      });
      return fxNow = Date.now();
    }
    function genFx(type, includeWidth) {
      var which, i = 0, attrs = { height: type };
      includeWidth = includeWidth ? 1 : 0;
      for (;i < 4; i += 2 - includeWidth) {
        which = cssExpand[i];
        attrs["margin" + which] = attrs["padding" + which] = type;
      }
      if (includeWidth) {
        attrs.opacity = attrs.width = type;
      }
      return attrs;
    }
    function createTween(value, prop, animation) {
      var tween, collection = (Animation.tweeners[prop] || []).concat(Animation.tweeners["*"]), index = 0, length = collection.length;
      for (;index < length; index++) {
        if (tween = collection[index].call(animation, prop, value)) {
          return tween;
        }
      }
    }
    function defaultPrefilter(elem, props, opts) {
      var prop, value, toggle, hooks, oldfire, propTween, restoreDisplay, display, isBox = "width" in props || "height" in props, anim = this, orig = {}, style = elem.style, hidden = elem.nodeType && isHiddenWithinTree(elem), dataShow = dataPriv.get(elem, "fxshow");
      if (!opts.queue) {
        hooks = jQuery._queueHooks(elem, "fx");
        if (hooks.unqueued == null) {
          hooks.unqueued = 0;
          oldfire = hooks.empty.fire;
          hooks.empty.fire = function() {
            if (!hooks.unqueued) {
              oldfire();
            }
          };
        }
        hooks.unqueued++;
        anim.always(function() {
          anim.always(function() {
            hooks.unqueued--;
            if (!jQuery.queue(elem, "fx").length) {
              hooks.empty.fire();
            }
          });
        });
      }
      for (prop in props) {
        value = props[prop];
        if (rfxtypes.test(value)) {
          delete props[prop];
          toggle = toggle || value === "toggle";
          if (value === (hidden ? "hide" : "show")) {
            if (value === "show" && dataShow && dataShow[prop] !== undefined) {
              hidden = true;
            } else {
              continue;
            }
          }
          orig[prop] = dataShow && dataShow[prop] || jQuery.style(elem, prop);
        }
      }
      propTween = !jQuery.isEmptyObject(props);
      if (!propTween && jQuery.isEmptyObject(orig)) {
        return;
      }
      if (isBox && elem.nodeType === 1) {
        opts.overflow = [style.overflow, style.overflowX, style.overflowY];
        restoreDisplay = dataShow && dataShow.display;
        if (restoreDisplay == null) {
          restoreDisplay = dataPriv.get(elem, "display");
        }
        display = jQuery.css(elem, "display");
        if (display === "none") {
          if (restoreDisplay) {
            display = restoreDisplay;
          } else {
            showHide([elem], true);
            restoreDisplay = elem.style.display || restoreDisplay;
            display = jQuery.css(elem, "display");
            showHide([elem]);
          }
        }
        if (display === "inline" || display === "inline-block" && restoreDisplay != null) {
          if (jQuery.css(elem, "float") === "none") {
            if (!propTween) {
              anim.done(function() {
                style.display = restoreDisplay;
              });
              if (restoreDisplay == null) {
                display = style.display;
                restoreDisplay = display === "none" ? "" : display;
              }
            }
            style.display = "inline-block";
          }
        }
      }
      if (opts.overflow) {
        style.overflow = "hidden";
        anim.always(function() {
          style.overflow = opts.overflow[0];
          style.overflowX = opts.overflow[1];
          style.overflowY = opts.overflow[2];
        });
      }
      propTween = false;
      for (prop in orig) {
        if (!propTween) {
          if (dataShow) {
            if ("hidden" in dataShow) {
              hidden = dataShow.hidden;
            }
          } else {
            dataShow = dataPriv.access(elem, "fxshow", { display: restoreDisplay });
          }
          if (toggle) {
            dataShow.hidden = !hidden;
          }
          if (hidden) {
            showHide([elem], true);
          }
          anim.done(function() {
            if (!hidden) {
              showHide([elem]);
            }
            dataPriv.remove(elem, "fxshow");
            for (prop in orig) {
              jQuery.style(elem, prop, orig[prop]);
            }
          });
        }
        propTween = createTween(hidden ? dataShow[prop] : 0, prop, anim);
        if (!(prop in dataShow)) {
          dataShow[prop] = propTween.start;
          if (hidden) {
            propTween.end = propTween.start;
            propTween.start = 0;
          }
        }
      }
    }
    function propFilter(props, specialEasing) {
      var index, name, easing, value, hooks;
      for (index in props) {
        name = camelCase(index);
        easing = specialEasing[name];
        value = props[index];
        if (Array.isArray(value)) {
          easing = value[1];
          value = props[index] = value[0];
        }
        if (index !== name) {
          props[name] = value;
          delete props[index];
        }
        hooks = jQuery.cssHooks[name];
        if (hooks && "expand" in hooks) {
          value = hooks.expand(value);
          delete props[name];
          for (index in value) {
            if (!(index in props)) {
              props[index] = value[index];
              specialEasing[index] = easing;
            }
          }
        } else {
          specialEasing[name] = easing;
        }
      }
    }
    function Animation(elem, properties, options) {
      var result, stopped, index = 0, length = Animation.prefilters.length, deferred = jQuery.Deferred().always(function() {
        delete tick.elem;
      }), tick = function() {
        if (stopped) {
          return false;
        }
        var currentTime = fxNow || createFxNow(), remaining = Math.max(0, animation.startTime + animation.duration - currentTime), temp = remaining / animation.duration || 0, percent = 1 - temp, index = 0, length = animation.tweens.length;
        for (;index < length; index++) {
          animation.tweens[index].run(percent);
        }
        deferred.notifyWith(elem, [animation, percent, remaining]);
        if (percent < 1 && length) {
          return remaining;
        }
        if (!length) {
          deferred.notifyWith(elem, [animation, 1, 0]);
        }
        deferred.resolveWith(elem, [animation]);
        return false;
      }, animation = deferred.promise({
        elem,
        props: jQuery.extend({}, properties),
        opts: jQuery.extend(true, {
          specialEasing: {},
          easing: jQuery.easing._default
        }, options),
        originalProperties: properties,
        originalOptions: options,
        startTime: fxNow || createFxNow(),
        duration: options.duration,
        tweens: [],
        createTween: function(prop, end) {
          var tween = jQuery.Tween(elem, animation.opts, prop, end, animation.opts.specialEasing[prop] || animation.opts.easing);
          animation.tweens.push(tween);
          return tween;
        },
        stop: function(gotoEnd) {
          var index = 0, length = gotoEnd ? animation.tweens.length : 0;
          if (stopped) {
            return this;
          }
          stopped = true;
          for (;index < length; index++) {
            animation.tweens[index].run(1);
          }
          if (gotoEnd) {
            deferred.notifyWith(elem, [animation, 1, 0]);
            deferred.resolveWith(elem, [animation, gotoEnd]);
          } else {
            deferred.rejectWith(elem, [animation, gotoEnd]);
          }
          return this;
        }
      }), props = animation.props;
      propFilter(props, animation.opts.specialEasing);
      for (;index < length; index++) {
        result = Animation.prefilters[index].call(animation, elem, props, animation.opts);
        if (result) {
          if (isFunction(result.stop)) {
            jQuery._queueHooks(animation.elem, animation.opts.queue).stop = result.stop.bind(result);
          }
          return result;
        }
      }
      jQuery.map(props, createTween, animation);
      if (isFunction(animation.opts.start)) {
        animation.opts.start.call(elem, animation);
      }
      animation.progress(animation.opts.progress).done(animation.opts.done, animation.opts.complete).fail(animation.opts.fail).always(animation.opts.always);
      jQuery.fx.timer(jQuery.extend(tick, {
        elem,
        anim: animation,
        queue: animation.opts.queue
      }));
      return animation;
    }
    jQuery.Animation = jQuery.extend(Animation, {
      tweeners: {
        "*": [function(prop, value) {
          var tween = this.createTween(prop, value);
          adjustCSS(tween.elem, prop, rcssNum.exec(value), tween);
          return tween;
        }]
      },
      tweener: function(props, callback) {
        if (isFunction(props)) {
          callback = props;
          props = ["*"];
        } else {
          props = props.match(rnothtmlwhite);
        }
        var prop, index = 0, length = props.length;
        for (;index < length; index++) {
          prop = props[index];
          Animation.tweeners[prop] = Animation.tweeners[prop] || [];
          Animation.tweeners[prop].unshift(callback);
        }
      },
      prefilters: [defaultPrefilter],
      prefilter: function(callback, prepend) {
        if (prepend) {
          Animation.prefilters.unshift(callback);
        } else {
          Animation.prefilters.push(callback);
        }
      }
    });
    jQuery.speed = function(speed, easing, fn) {
      var opt = speed && typeof speed === "object" ? jQuery.extend({}, speed) : {
        complete: fn || !fn && easing || isFunction(speed) && speed,
        duration: speed,
        easing: fn && easing || easing && !isFunction(easing) && easing
      };
      if (jQuery.fx.off) {
        opt.duration = 0;
      } else {
        if (typeof opt.duration !== "number") {
          if (opt.duration in jQuery.fx.speeds) {
            opt.duration = jQuery.fx.speeds[opt.duration];
          } else {
            opt.duration = jQuery.fx.speeds._default;
          }
        }
      }
      if (opt.queue == null || opt.queue === true) {
        opt.queue = "fx";
      }
      opt.old = opt.complete;
      opt.complete = function() {
        if (isFunction(opt.old)) {
          opt.old.call(this);
        }
        if (opt.queue) {
          jQuery.dequeue(this, opt.queue);
        }
      };
      return opt;
    };
    jQuery.fn.extend({
      fadeTo: function(speed, to, easing, callback) {
        return this.filter(isHiddenWithinTree).css("opacity", 0).show().end().animate({ opacity: to }, speed, easing, callback);
      },
      animate: function(prop, speed, easing, callback) {
        var empty = jQuery.isEmptyObject(prop), optall = jQuery.speed(speed, easing, callback), doAnimation = function() {
          var anim = Animation(this, jQuery.extend({}, prop), optall);
          if (empty || dataPriv.get(this, "finish")) {
            anim.stop(true);
          }
        };
        doAnimation.finish = doAnimation;
        return empty || optall.queue === false ? this.each(doAnimation) : this.queue(optall.queue, doAnimation);
      },
      stop: function(type, clearQueue, gotoEnd) {
        var stopQueue = function(hooks) {
          var stop = hooks.stop;
          delete hooks.stop;
          stop(gotoEnd);
        };
        if (typeof type !== "string") {
          gotoEnd = clearQueue;
          clearQueue = type;
          type = undefined;
        }
        if (clearQueue) {
          this.queue(type || "fx", []);
        }
        return this.each(function() {
          var dequeue = true, index = type != null && type + "queueHooks", timers = jQuery.timers, data = dataPriv.get(this);
          if (index) {
            if (data[index] && data[index].stop) {
              stopQueue(data[index]);
            }
          } else {
            for (index in data) {
              if (data[index] && data[index].stop && rrun.test(index)) {
                stopQueue(data[index]);
              }
            }
          }
          for (index = timers.length;index--; ) {
            if (timers[index].elem === this && (type == null || timers[index].queue === type)) {
              timers[index].anim.stop(gotoEnd);
              dequeue = false;
              timers.splice(index, 1);
            }
          }
          if (dequeue || !gotoEnd) {
            jQuery.dequeue(this, type);
          }
        });
      },
      finish: function(type) {
        if (type !== false) {
          type = type || "fx";
        }
        return this.each(function() {
          var index, data = dataPriv.get(this), queue = data[type + "queue"], hooks = data[type + "queueHooks"], timers = jQuery.timers, length = queue ? queue.length : 0;
          data.finish = true;
          jQuery.queue(this, type, []);
          if (hooks && hooks.stop) {
            hooks.stop.call(this, true);
          }
          for (index = timers.length;index--; ) {
            if (timers[index].elem === this && timers[index].queue === type) {
              timers[index].anim.stop(true);
              timers.splice(index, 1);
            }
          }
          for (index = 0;index < length; index++) {
            if (queue[index] && queue[index].finish) {
              queue[index].finish.call(this);
            }
          }
          delete data.finish;
        });
      }
    });
    jQuery.each(["toggle", "show", "hide"], function(_i, name) {
      var cssFn = jQuery.fn[name];
      jQuery.fn[name] = function(speed, easing, callback) {
        return speed == null || typeof speed === "boolean" ? cssFn.apply(this, arguments) : this.animate(genFx(name, true), speed, easing, callback);
      };
    });
    jQuery.each({
      slideDown: genFx("show"),
      slideUp: genFx("hide"),
      slideToggle: genFx("toggle"),
      fadeIn: { opacity: "show" },
      fadeOut: { opacity: "hide" },
      fadeToggle: { opacity: "toggle" }
    }, function(name, props) {
      jQuery.fn[name] = function(speed, easing, callback) {
        return this.animate(props, speed, easing, callback);
      };
    });
    jQuery.timers = [];
    jQuery.fx.tick = function() {
      var timer, i = 0, timers = jQuery.timers;
      fxNow = Date.now();
      for (;i < timers.length; i++) {
        timer = timers[i];
        if (!timer() && timers[i] === timer) {
          timers.splice(i--, 1);
        }
      }
      if (!timers.length) {
        jQuery.fx.stop();
      }
      fxNow = undefined;
    };
    jQuery.fx.timer = function(timer) {
      jQuery.timers.push(timer);
      jQuery.fx.start();
    };
    jQuery.fx.interval = 13;
    jQuery.fx.start = function() {
      if (inProgress) {
        return;
      }
      inProgress = true;
      schedule();
    };
    jQuery.fx.stop = function() {
      inProgress = null;
    };
    jQuery.fx.speeds = {
      slow: 600,
      fast: 200,
      _default: 400
    };
    jQuery.fn.delay = function(time, type) {
      time = jQuery.fx ? jQuery.fx.speeds[time] || time : time;
      type = type || "fx";
      return this.queue(type, function(next, hooks) {
        var timeout = window2.setTimeout(next, time);
        hooks.stop = function() {
          window2.clearTimeout(timeout);
        };
      });
    };
    (function() {
      var input = document2.createElement("input"), select = document2.createElement("select"), opt = select.appendChild(document2.createElement("option"));
      input.type = "checkbox";
      support.checkOn = input.value !== "";
      support.optSelected = opt.selected;
      input = document2.createElement("input");
      input.value = "t";
      input.type = "radio";
      support.radioValue = input.value === "t";
    })();
    var boolHook, attrHandle = jQuery.expr.attrHandle;
    jQuery.fn.extend({
      attr: function(name, value) {
        return access(this, jQuery.attr, name, value, arguments.length > 1);
      },
      removeAttr: function(name) {
        return this.each(function() {
          jQuery.removeAttr(this, name);
        });
      }
    });
    jQuery.extend({
      attr: function(elem, name, value) {
        var ret, hooks, nType = elem.nodeType;
        if (nType === 3 || nType === 8 || nType === 2) {
          return;
        }
        if (typeof elem.getAttribute === "undefined") {
          return jQuery.prop(elem, name, value);
        }
        if (nType !== 1 || !jQuery.isXMLDoc(elem)) {
          hooks = jQuery.attrHooks[name.toLowerCase()] || (jQuery.expr.match.bool.test(name) ? boolHook : undefined);
        }
        if (value !== undefined) {
          if (value === null) {
            jQuery.removeAttr(elem, name);
            return;
          }
          if (hooks && "set" in hooks && (ret = hooks.set(elem, value, name)) !== undefined) {
            return ret;
          }
          elem.setAttribute(name, value + "");
          return value;
        }
        if (hooks && "get" in hooks && (ret = hooks.get(elem, name)) !== null) {
          return ret;
        }
        ret = jQuery.find.attr(elem, name);
        return ret == null ? undefined : ret;
      },
      attrHooks: {
        type: {
          set: function(elem, value) {
            if (!support.radioValue && value === "radio" && nodeName(elem, "input")) {
              var val = elem.value;
              elem.setAttribute("type", value);
              if (val) {
                elem.value = val;
              }
              return value;
            }
          }
        }
      },
      removeAttr: function(elem, value) {
        var name, i = 0, attrNames = value && value.match(rnothtmlwhite);
        if (attrNames && elem.nodeType === 1) {
          while (name = attrNames[i++]) {
            elem.removeAttribute(name);
          }
        }
      }
    });
    boolHook = {
      set: function(elem, value, name) {
        if (value === false) {
          jQuery.removeAttr(elem, name);
        } else {
          elem.setAttribute(name, name);
        }
        return name;
      }
    };
    jQuery.each(jQuery.expr.match.bool.source.match(/\w+/g), function(_i, name) {
      var getter = attrHandle[name] || jQuery.find.attr;
      attrHandle[name] = function(elem, name, isXML) {
        var ret, handle, lowercaseName = name.toLowerCase();
        if (!isXML) {
          handle = attrHandle[lowercaseName];
          attrHandle[lowercaseName] = ret;
          ret = getter(elem, name, isXML) != null ? lowercaseName : null;
          attrHandle[lowercaseName] = handle;
        }
        return ret;
      };
    });
    var rfocusable = /^(?:input|select|textarea|button)$/i, rclickable = /^(?:a|area)$/i;
    jQuery.fn.extend({
      prop: function(name, value) {
        return access(this, jQuery.prop, name, value, arguments.length > 1);
      },
      removeProp: function(name) {
        return this.each(function() {
          delete this[jQuery.propFix[name] || name];
        });
      }
    });
    jQuery.extend({
      prop: function(elem, name, value) {
        var ret, hooks, nType = elem.nodeType;
        if (nType === 3 || nType === 8 || nType === 2) {
          return;
        }
        if (nType !== 1 || !jQuery.isXMLDoc(elem)) {
          name = jQuery.propFix[name] || name;
          hooks = jQuery.propHooks[name];
        }
        if (value !== undefined) {
          if (hooks && "set" in hooks && (ret = hooks.set(elem, value, name)) !== undefined) {
            return ret;
          }
          return elem[name] = value;
        }
        if (hooks && "get" in hooks && (ret = hooks.get(elem, name)) !== null) {
          return ret;
        }
        return elem[name];
      },
      propHooks: {
        tabIndex: {
          get: function(elem) {
            var tabindex = jQuery.find.attr(elem, "tabindex");
            if (tabindex) {
              return parseInt(tabindex, 10);
            }
            if (rfocusable.test(elem.nodeName) || rclickable.test(elem.nodeName) && elem.href) {
              return 0;
            }
            return -1;
          }
        }
      },
      propFix: {
        for: "htmlFor",
        class: "className"
      }
    });
    if (!support.optSelected) {
      jQuery.propHooks.selected = {
        get: function(elem) {
          var parent = elem.parentNode;
          if (parent && parent.parentNode) {
            parent.parentNode.selectedIndex;
          }
          return null;
        },
        set: function(elem) {
          var parent = elem.parentNode;
          if (parent) {
            parent.selectedIndex;
            if (parent.parentNode) {
              parent.parentNode.selectedIndex;
            }
          }
        }
      };
    }
    jQuery.each([
      "tabIndex",
      "readOnly",
      "maxLength",
      "cellSpacing",
      "cellPadding",
      "rowSpan",
      "colSpan",
      "useMap",
      "frameBorder",
      "contentEditable"
    ], function() {
      jQuery.propFix[this.toLowerCase()] = this;
    });
    function stripAndCollapse(value) {
      var tokens = value.match(rnothtmlwhite) || [];
      return tokens.join(" ");
    }
    function getClass(elem) {
      return elem.getAttribute && elem.getAttribute("class") || "";
    }
    function classesToArray(value) {
      if (Array.isArray(value)) {
        return value;
      }
      if (typeof value === "string") {
        return value.match(rnothtmlwhite) || [];
      }
      return [];
    }
    jQuery.fn.extend({
      addClass: function(value) {
        var classNames, cur, curValue, className, i, finalValue;
        if (isFunction(value)) {
          return this.each(function(j) {
            jQuery(this).addClass(value.call(this, j, getClass(this)));
          });
        }
        classNames = classesToArray(value);
        if (classNames.length) {
          return this.each(function() {
            curValue = getClass(this);
            cur = this.nodeType === 1 && " " + stripAndCollapse(curValue) + " ";
            if (cur) {
              for (i = 0;i < classNames.length; i++) {
                className = classNames[i];
                if (cur.indexOf(" " + className + " ") < 0) {
                  cur += className + " ";
                }
              }
              finalValue = stripAndCollapse(cur);
              if (curValue !== finalValue) {
                this.setAttribute("class", finalValue);
              }
            }
          });
        }
        return this;
      },
      removeClass: function(value) {
        var classNames, cur, curValue, className, i, finalValue;
        if (isFunction(value)) {
          return this.each(function(j) {
            jQuery(this).removeClass(value.call(this, j, getClass(this)));
          });
        }
        if (!arguments.length) {
          return this.attr("class", "");
        }
        classNames = classesToArray(value);
        if (classNames.length) {
          return this.each(function() {
            curValue = getClass(this);
            cur = this.nodeType === 1 && " " + stripAndCollapse(curValue) + " ";
            if (cur) {
              for (i = 0;i < classNames.length; i++) {
                className = classNames[i];
                while (cur.indexOf(" " + className + " ") > -1) {
                  cur = cur.replace(" " + className + " ", " ");
                }
              }
              finalValue = stripAndCollapse(cur);
              if (curValue !== finalValue) {
                this.setAttribute("class", finalValue);
              }
            }
          });
        }
        return this;
      },
      toggleClass: function(value, stateVal) {
        var classNames, className, i, self, type = typeof value, isValidValue = type === "string" || Array.isArray(value);
        if (isFunction(value)) {
          return this.each(function(i) {
            jQuery(this).toggleClass(value.call(this, i, getClass(this), stateVal), stateVal);
          });
        }
        if (typeof stateVal === "boolean" && isValidValue) {
          return stateVal ? this.addClass(value) : this.removeClass(value);
        }
        classNames = classesToArray(value);
        return this.each(function() {
          if (isValidValue) {
            self = jQuery(this);
            for (i = 0;i < classNames.length; i++) {
              className = classNames[i];
              if (self.hasClass(className)) {
                self.removeClass(className);
              } else {
                self.addClass(className);
              }
            }
          } else if (value === undefined || type === "boolean") {
            className = getClass(this);
            if (className) {
              dataPriv.set(this, "__className__", className);
            }
            if (this.setAttribute) {
              this.setAttribute("class", className || value === false ? "" : dataPriv.get(this, "__className__") || "");
            }
          }
        });
      },
      hasClass: function(selector) {
        var className, elem, i = 0;
        className = " " + selector + " ";
        while (elem = this[i++]) {
          if (elem.nodeType === 1 && (" " + stripAndCollapse(getClass(elem)) + " ").indexOf(className) > -1) {
            return true;
          }
        }
        return false;
      }
    });
    var rreturn = /\r/g;
    jQuery.fn.extend({
      val: function(value) {
        var hooks, ret, valueIsFunction, elem = this[0];
        if (!arguments.length) {
          if (elem) {
            hooks = jQuery.valHooks[elem.type] || jQuery.valHooks[elem.nodeName.toLowerCase()];
            if (hooks && "get" in hooks && (ret = hooks.get(elem, "value")) !== undefined) {
              return ret;
            }
            ret = elem.value;
            if (typeof ret === "string") {
              return ret.replace(rreturn, "");
            }
            return ret == null ? "" : ret;
          }
          return;
        }
        valueIsFunction = isFunction(value);
        return this.each(function(i) {
          var val;
          if (this.nodeType !== 1) {
            return;
          }
          if (valueIsFunction) {
            val = value.call(this, i, jQuery(this).val());
          } else {
            val = value;
          }
          if (val == null) {
            val = "";
          } else if (typeof val === "number") {
            val += "";
          } else if (Array.isArray(val)) {
            val = jQuery.map(val, function(value) {
              return value == null ? "" : value + "";
            });
          }
          hooks = jQuery.valHooks[this.type] || jQuery.valHooks[this.nodeName.toLowerCase()];
          if (!hooks || !("set" in hooks) || hooks.set(this, val, "value") === undefined) {
            this.value = val;
          }
        });
      }
    });
    jQuery.extend({
      valHooks: {
        option: {
          get: function(elem) {
            var val = jQuery.find.attr(elem, "value");
            return val != null ? val : stripAndCollapse(jQuery.text(elem));
          }
        },
        select: {
          get: function(elem) {
            var value, option, i, { options, selectedIndex: index } = elem, one = elem.type === "select-one", values = one ? null : [], max = one ? index + 1 : options.length;
            if (index < 0) {
              i = max;
            } else {
              i = one ? index : 0;
            }
            for (;i < max; i++) {
              option = options[i];
              if ((option.selected || i === index) && !option.disabled && (!option.parentNode.disabled || !nodeName(option.parentNode, "optgroup"))) {
                value = jQuery(option).val();
                if (one) {
                  return value;
                }
                values.push(value);
              }
            }
            return values;
          },
          set: function(elem, value) {
            var optionSet, option, options = elem.options, values = jQuery.makeArray(value), i = options.length;
            while (i--) {
              option = options[i];
              if (option.selected = jQuery.inArray(jQuery.valHooks.option.get(option), values) > -1) {
                optionSet = true;
              }
            }
            if (!optionSet) {
              elem.selectedIndex = -1;
            }
            return values;
          }
        }
      }
    });
    jQuery.each(["radio", "checkbox"], function() {
      jQuery.valHooks[this] = {
        set: function(elem, value) {
          if (Array.isArray(value)) {
            return elem.checked = jQuery.inArray(jQuery(elem).val(), value) > -1;
          }
        }
      };
      if (!support.checkOn) {
        jQuery.valHooks[this].get = function(elem) {
          return elem.getAttribute("value") === null ? "on" : elem.value;
        };
      }
    });
    var location = window2.location;
    var nonce = { guid: Date.now() };
    var rquery = /\?/;
    jQuery.parseXML = function(data) {
      var xml, parserErrorElem;
      if (!data || typeof data !== "string") {
        return null;
      }
      try {
        xml = new window2.DOMParser().parseFromString(data, "text/xml");
      } catch (e) {}
      parserErrorElem = xml && xml.getElementsByTagName("parsererror")[0];
      if (!xml || parserErrorElem) {
        jQuery.error("Invalid XML: " + (parserErrorElem ? jQuery.map(parserErrorElem.childNodes, function(el) {
          return el.textContent;
        }).join(`
`) : data));
      }
      return xml;
    };
    var rfocusMorph = /^(?:focusinfocus|focusoutblur)$/, stopPropagationCallback = function(e) {
      e.stopPropagation();
    };
    jQuery.extend(jQuery.event, {
      trigger: function(event, data, elem, onlyHandlers) {
        var i, cur, tmp, bubbleType, ontype, handle, special, lastElement, eventPath = [elem || document2], type = hasOwn.call(event, "type") ? event.type : event, namespaces = hasOwn.call(event, "namespace") ? event.namespace.split(".") : [];
        cur = lastElement = tmp = elem = elem || document2;
        if (elem.nodeType === 3 || elem.nodeType === 8) {
          return;
        }
        if (rfocusMorph.test(type + jQuery.event.triggered)) {
          return;
        }
        if (type.indexOf(".") > -1) {
          namespaces = type.split(".");
          type = namespaces.shift();
          namespaces.sort();
        }
        ontype = type.indexOf(":") < 0 && "on" + type;
        event = event[jQuery.expando] ? event : new jQuery.Event(type, typeof event === "object" && event);
        event.isTrigger = onlyHandlers ? 2 : 3;
        event.namespace = namespaces.join(".");
        event.rnamespace = event.namespace ? new RegExp("(^|\\.)" + namespaces.join("\\.(?:.*\\.|)") + "(\\.|$)") : null;
        event.result = undefined;
        if (!event.target) {
          event.target = elem;
        }
        data = data == null ? [event] : jQuery.makeArray(data, [event]);
        special = jQuery.event.special[type] || {};
        if (!onlyHandlers && special.trigger && special.trigger.apply(elem, data) === false) {
          return;
        }
        if (!onlyHandlers && !special.noBubble && !isWindow(elem)) {
          bubbleType = special.delegateType || type;
          if (!rfocusMorph.test(bubbleType + type)) {
            cur = cur.parentNode;
          }
          for (;cur; cur = cur.parentNode) {
            eventPath.push(cur);
            tmp = cur;
          }
          if (tmp === (elem.ownerDocument || document2)) {
            eventPath.push(tmp.defaultView || tmp.parentWindow || window2);
          }
        }
        i = 0;
        while ((cur = eventPath[i++]) && !event.isPropagationStopped()) {
          lastElement = cur;
          event.type = i > 1 ? bubbleType : special.bindType || type;
          handle = (dataPriv.get(cur, "events") || Object.create(null))[event.type] && dataPriv.get(cur, "handle");
          if (handle) {
            handle.apply(cur, data);
          }
          handle = ontype && cur[ontype];
          if (handle && handle.apply && acceptData(cur)) {
            event.result = handle.apply(cur, data);
            if (event.result === false) {
              event.preventDefault();
            }
          }
        }
        event.type = type;
        if (!onlyHandlers && !event.isDefaultPrevented()) {
          if ((!special._default || special._default.apply(eventPath.pop(), data) === false) && acceptData(elem)) {
            if (ontype && isFunction(elem[type]) && !isWindow(elem)) {
              tmp = elem[ontype];
              if (tmp) {
                elem[ontype] = null;
              }
              jQuery.event.triggered = type;
              if (event.isPropagationStopped()) {
                lastElement.addEventListener(type, stopPropagationCallback);
              }
              elem[type]();
              if (event.isPropagationStopped()) {
                lastElement.removeEventListener(type, stopPropagationCallback);
              }
              jQuery.event.triggered = undefined;
              if (tmp) {
                elem[ontype] = tmp;
              }
            }
          }
        }
        return event.result;
      },
      simulate: function(type, elem, event) {
        var e = jQuery.extend(new jQuery.Event, event, {
          type,
          isSimulated: true
        });
        jQuery.event.trigger(e, null, elem);
      }
    });
    jQuery.fn.extend({
      trigger: function(type, data) {
        return this.each(function() {
          jQuery.event.trigger(type, data, this);
        });
      },
      triggerHandler: function(type, data) {
        var elem = this[0];
        if (elem) {
          return jQuery.event.trigger(type, data, elem, true);
        }
      }
    });
    var rbracket = /\[\]$/, rCRLF = /\r?\n/g, rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i, rsubmittable = /^(?:input|select|textarea|keygen)/i;
    function buildParams(prefix, obj, traditional, add) {
      var name;
      if (Array.isArray(obj)) {
        jQuery.each(obj, function(i, v) {
          if (traditional || rbracket.test(prefix)) {
            add(prefix, v);
          } else {
            buildParams(prefix + "[" + (typeof v === "object" && v != null ? i : "") + "]", v, traditional, add);
          }
        });
      } else if (!traditional && toType(obj) === "object") {
        for (name in obj) {
          buildParams(prefix + "[" + name + "]", obj[name], traditional, add);
        }
      } else {
        add(prefix, obj);
      }
    }
    jQuery.param = function(a, traditional) {
      var prefix, s = [], add = function(key, valueOrFunction) {
        var value = isFunction(valueOrFunction) ? valueOrFunction() : valueOrFunction;
        s[s.length] = encodeURIComponent(key) + "=" + encodeURIComponent(value == null ? "" : value);
      };
      if (a == null) {
        return "";
      }
      if (Array.isArray(a) || a.jquery && !jQuery.isPlainObject(a)) {
        jQuery.each(a, function() {
          add(this.name, this.value);
        });
      } else {
        for (prefix in a) {
          buildParams(prefix, a[prefix], traditional, add);
        }
      }
      return s.join("&");
    };
    jQuery.fn.extend({
      serialize: function() {
        return jQuery.param(this.serializeArray());
      },
      serializeArray: function() {
        return this.map(function() {
          var elements = jQuery.prop(this, "elements");
          return elements ? jQuery.makeArray(elements) : this;
        }).filter(function() {
          var type = this.type;
          return this.name && !jQuery(this).is(":disabled") && rsubmittable.test(this.nodeName) && !rsubmitterTypes.test(type) && (this.checked || !rcheckableType.test(type));
        }).map(function(_i, elem) {
          var val = jQuery(this).val();
          if (val == null) {
            return null;
          }
          if (Array.isArray(val)) {
            return jQuery.map(val, function(val) {
              return { name: elem.name, value: val.replace(rCRLF, `\r
`) };
            });
          }
          return { name: elem.name, value: val.replace(rCRLF, `\r
`) };
        }).get();
      }
    });
    var r20 = /%20/g, rhash = /#.*$/, rantiCache = /([?&])_=[^&]*/, rheaders = /^(.*?):[ \t]*([^\r\n]*)$/mg, rlocalProtocol = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/, rnoContent = /^(?:GET|HEAD)$/, rprotocol = /^\/\//, prefilters = {}, transports = {}, allTypes = "*/".concat("*"), originAnchor = document2.createElement("a");
    originAnchor.href = location.href;
    function addToPrefiltersOrTransports(structure) {
      return function(dataTypeExpression, func) {
        if (typeof dataTypeExpression !== "string") {
          func = dataTypeExpression;
          dataTypeExpression = "*";
        }
        var dataType, i = 0, dataTypes = dataTypeExpression.toLowerCase().match(rnothtmlwhite) || [];
        if (isFunction(func)) {
          while (dataType = dataTypes[i++]) {
            if (dataType[0] === "+") {
              dataType = dataType.slice(1) || "*";
              (structure[dataType] = structure[dataType] || []).unshift(func);
            } else {
              (structure[dataType] = structure[dataType] || []).push(func);
            }
          }
        }
      };
    }
    function inspectPrefiltersOrTransports(structure, options, originalOptions, jqXHR) {
      var inspected = {}, seekingTransport = structure === transports;
      function inspect(dataType) {
        var selected;
        inspected[dataType] = true;
        jQuery.each(structure[dataType] || [], function(_, prefilterOrFactory) {
          var dataTypeOrTransport = prefilterOrFactory(options, originalOptions, jqXHR);
          if (typeof dataTypeOrTransport === "string" && !seekingTransport && !inspected[dataTypeOrTransport]) {
            options.dataTypes.unshift(dataTypeOrTransport);
            inspect(dataTypeOrTransport);
            return false;
          } else if (seekingTransport) {
            return !(selected = dataTypeOrTransport);
          }
        });
        return selected;
      }
      return inspect(options.dataTypes[0]) || !inspected["*"] && inspect("*");
    }
    function ajaxExtend(target, src) {
      var key, deep, flatOptions = jQuery.ajaxSettings.flatOptions || {};
      for (key in src) {
        if (src[key] !== undefined) {
          (flatOptions[key] ? target : deep || (deep = {}))[key] = src[key];
        }
      }
      if (deep) {
        jQuery.extend(true, target, deep);
      }
      return target;
    }
    function ajaxHandleResponses(s, jqXHR, responses) {
      var ct, type, finalDataType, firstDataType, { contents, dataTypes } = s;
      while (dataTypes[0] === "*") {
        dataTypes.shift();
        if (ct === undefined) {
          ct = s.mimeType || jqXHR.getResponseHeader("Content-Type");
        }
      }
      if (ct) {
        for (type in contents) {
          if (contents[type] && contents[type].test(ct)) {
            dataTypes.unshift(type);
            break;
          }
        }
      }
      if (dataTypes[0] in responses) {
        finalDataType = dataTypes[0];
      } else {
        for (type in responses) {
          if (!dataTypes[0] || s.converters[type + " " + dataTypes[0]]) {
            finalDataType = type;
            break;
          }
          if (!firstDataType) {
            firstDataType = type;
          }
        }
        finalDataType = finalDataType || firstDataType;
      }
      if (finalDataType) {
        if (finalDataType !== dataTypes[0]) {
          dataTypes.unshift(finalDataType);
        }
        return responses[finalDataType];
      }
    }
    function ajaxConvert(s, response, jqXHR, isSuccess) {
      var conv2, current, conv, tmp, prev, converters = {}, dataTypes = s.dataTypes.slice();
      if (dataTypes[1]) {
        for (conv in s.converters) {
          converters[conv.toLowerCase()] = s.converters[conv];
        }
      }
      current = dataTypes.shift();
      while (current) {
        if (s.responseFields[current]) {
          jqXHR[s.responseFields[current]] = response;
        }
        if (!prev && isSuccess && s.dataFilter) {
          response = s.dataFilter(response, s.dataType);
        }
        prev = current;
        current = dataTypes.shift();
        if (current) {
          if (current === "*") {
            current = prev;
          } else if (prev !== "*" && prev !== current) {
            conv = converters[prev + " " + current] || converters["* " + current];
            if (!conv) {
              for (conv2 in converters) {
                tmp = conv2.split(" ");
                if (tmp[1] === current) {
                  conv = converters[prev + " " + tmp[0]] || converters["* " + tmp[0]];
                  if (conv) {
                    if (conv === true) {
                      conv = converters[conv2];
                    } else if (converters[conv2] !== true) {
                      current = tmp[0];
                      dataTypes.unshift(tmp[1]);
                    }
                    break;
                  }
                }
              }
            }
            if (conv !== true) {
              if (conv && s.throws) {
                response = conv(response);
              } else {
                try {
                  response = conv(response);
                } catch (e) {
                  return {
                    state: "parsererror",
                    error: conv ? e : "No conversion from " + prev + " to " + current
                  };
                }
              }
            }
          }
        }
      }
      return { state: "success", data: response };
    }
    jQuery.extend({
      active: 0,
      lastModified: {},
      etag: {},
      ajaxSettings: {
        url: location.href,
        type: "GET",
        isLocal: rlocalProtocol.test(location.protocol),
        global: true,
        processData: true,
        async: true,
        contentType: "application/x-www-form-urlencoded; charset=UTF-8",
        accepts: {
          "*": allTypes,
          text: "text/plain",
          html: "text/html",
          xml: "application/xml, text/xml",
          json: "application/json, text/javascript"
        },
        contents: {
          xml: /\bxml\b/,
          html: /\bhtml/,
          json: /\bjson\b/
        },
        responseFields: {
          xml: "responseXML",
          text: "responseText",
          json: "responseJSON"
        },
        converters: {
          "* text": String,
          "text html": true,
          "text json": JSON.parse,
          "text xml": jQuery.parseXML
        },
        flatOptions: {
          url: true,
          context: true
        }
      },
      ajaxSetup: function(target, settings) {
        return settings ? ajaxExtend(ajaxExtend(target, jQuery.ajaxSettings), settings) : ajaxExtend(jQuery.ajaxSettings, target);
      },
      ajaxPrefilter: addToPrefiltersOrTransports(prefilters),
      ajaxTransport: addToPrefiltersOrTransports(transports),
      ajax: function(url, options) {
        if (typeof url === "object") {
          options = url;
          url = undefined;
        }
        options = options || {};
        var transport, cacheURL, responseHeadersString, responseHeaders, timeoutTimer, urlAnchor, completed, fireGlobals, i, uncached, s = jQuery.ajaxSetup({}, options), callbackContext = s.context || s, globalEventContext = s.context && (callbackContext.nodeType || callbackContext.jquery) ? jQuery(callbackContext) : jQuery.event, deferred = jQuery.Deferred(), completeDeferred = jQuery.Callbacks("once memory"), statusCode = s.statusCode || {}, requestHeaders = {}, requestHeadersNames = {}, strAbort = "canceled", jqXHR = {
          readyState: 0,
          getResponseHeader: function(key) {
            var match;
            if (completed) {
              if (!responseHeaders) {
                responseHeaders = {};
                while (match = rheaders.exec(responseHeadersString)) {
                  responseHeaders[match[1].toLowerCase() + " "] = (responseHeaders[match[1].toLowerCase() + " "] || []).concat(match[2]);
                }
              }
              match = responseHeaders[key.toLowerCase() + " "];
            }
            return match == null ? null : match.join(", ");
          },
          getAllResponseHeaders: function() {
            return completed ? responseHeadersString : null;
          },
          setRequestHeader: function(name, value) {
            if (completed == null) {
              name = requestHeadersNames[name.toLowerCase()] = requestHeadersNames[name.toLowerCase()] || name;
              requestHeaders[name] = value;
            }
            return this;
          },
          overrideMimeType: function(type) {
            if (completed == null) {
              s.mimeType = type;
            }
            return this;
          },
          statusCode: function(map) {
            var code;
            if (map) {
              if (completed) {
                jqXHR.always(map[jqXHR.status]);
              } else {
                for (code in map) {
                  statusCode[code] = [statusCode[code], map[code]];
                }
              }
            }
            return this;
          },
          abort: function(statusText) {
            var finalText = statusText || strAbort;
            if (transport) {
              transport.abort(finalText);
            }
            done(0, finalText);
            return this;
          }
        };
        deferred.promise(jqXHR);
        s.url = ((url || s.url || location.href) + "").replace(rprotocol, location.protocol + "//");
        s.type = options.method || options.type || s.method || s.type;
        s.dataTypes = (s.dataType || "*").toLowerCase().match(rnothtmlwhite) || [""];
        if (s.crossDomain == null) {
          urlAnchor = document2.createElement("a");
          try {
            urlAnchor.href = s.url;
            urlAnchor.href = urlAnchor.href;
            s.crossDomain = originAnchor.protocol + "//" + originAnchor.host !== urlAnchor.protocol + "//" + urlAnchor.host;
          } catch (e) {
            s.crossDomain = true;
          }
        }
        if (s.data && s.processData && typeof s.data !== "string") {
          s.data = jQuery.param(s.data, s.traditional);
        }
        inspectPrefiltersOrTransports(prefilters, s, options, jqXHR);
        if (completed) {
          return jqXHR;
        }
        fireGlobals = jQuery.event && s.global;
        if (fireGlobals && jQuery.active++ === 0) {
          jQuery.event.trigger("ajaxStart");
        }
        s.type = s.type.toUpperCase();
        s.hasContent = !rnoContent.test(s.type);
        cacheURL = s.url.replace(rhash, "");
        if (!s.hasContent) {
          uncached = s.url.slice(cacheURL.length);
          if (s.data && (s.processData || typeof s.data === "string")) {
            cacheURL += (rquery.test(cacheURL) ? "&" : "?") + s.data;
            delete s.data;
          }
          if (s.cache === false) {
            cacheURL = cacheURL.replace(rantiCache, "$1");
            uncached = (rquery.test(cacheURL) ? "&" : "?") + "_=" + nonce.guid++ + uncached;
          }
          s.url = cacheURL + uncached;
        } else if (s.data && s.processData && (s.contentType || "").indexOf("application/x-www-form-urlencoded") === 0) {
          s.data = s.data.replace(r20, "+");
        }
        if (s.ifModified) {
          if (jQuery.lastModified[cacheURL]) {
            jqXHR.setRequestHeader("If-Modified-Since", jQuery.lastModified[cacheURL]);
          }
          if (jQuery.etag[cacheURL]) {
            jqXHR.setRequestHeader("If-None-Match", jQuery.etag[cacheURL]);
          }
        }
        if (s.data && s.hasContent && s.contentType !== false || options.contentType) {
          jqXHR.setRequestHeader("Content-Type", s.contentType);
        }
        jqXHR.setRequestHeader("Accept", s.dataTypes[0] && s.accepts[s.dataTypes[0]] ? s.accepts[s.dataTypes[0]] + (s.dataTypes[0] !== "*" ? ", " + allTypes + "; q=0.01" : "") : s.accepts["*"]);
        for (i in s.headers) {
          jqXHR.setRequestHeader(i, s.headers[i]);
        }
        if (s.beforeSend && (s.beforeSend.call(callbackContext, jqXHR, s) === false || completed)) {
          return jqXHR.abort();
        }
        strAbort = "abort";
        completeDeferred.add(s.complete);
        jqXHR.done(s.success);
        jqXHR.fail(s.error);
        transport = inspectPrefiltersOrTransports(transports, s, options, jqXHR);
        if (!transport) {
          done(-1, "No Transport");
        } else {
          jqXHR.readyState = 1;
          if (fireGlobals) {
            globalEventContext.trigger("ajaxSend", [jqXHR, s]);
          }
          if (completed) {
            return jqXHR;
          }
          if (s.async && s.timeout > 0) {
            timeoutTimer = window2.setTimeout(function() {
              jqXHR.abort("timeout");
            }, s.timeout);
          }
          try {
            completed = false;
            transport.send(requestHeaders, done);
          } catch (e) {
            if (completed) {
              throw e;
            }
            done(-1, e);
          }
        }
        function done(status, nativeStatusText, responses, headers) {
          var isSuccess, success, error, response, modified, statusText = nativeStatusText;
          if (completed) {
            return;
          }
          completed = true;
          if (timeoutTimer) {
            window2.clearTimeout(timeoutTimer);
          }
          transport = undefined;
          responseHeadersString = headers || "";
          jqXHR.readyState = status > 0 ? 4 : 0;
          isSuccess = status >= 200 && status < 300 || status === 304;
          if (responses) {
            response = ajaxHandleResponses(s, jqXHR, responses);
          }
          if (!isSuccess && jQuery.inArray("script", s.dataTypes) > -1 && jQuery.inArray("json", s.dataTypes) < 0) {
            s.converters["text script"] = function() {};
          }
          response = ajaxConvert(s, response, jqXHR, isSuccess);
          if (isSuccess) {
            if (s.ifModified) {
              modified = jqXHR.getResponseHeader("Last-Modified");
              if (modified) {
                jQuery.lastModified[cacheURL] = modified;
              }
              modified = jqXHR.getResponseHeader("etag");
              if (modified) {
                jQuery.etag[cacheURL] = modified;
              }
            }
            if (status === 204 || s.type === "HEAD") {
              statusText = "nocontent";
            } else if (status === 304) {
              statusText = "notmodified";
            } else {
              statusText = response.state;
              success = response.data;
              error = response.error;
              isSuccess = !error;
            }
          } else {
            error = statusText;
            if (status || !statusText) {
              statusText = "error";
              if (status < 0) {
                status = 0;
              }
            }
          }
          jqXHR.status = status;
          jqXHR.statusText = (nativeStatusText || statusText) + "";
          if (isSuccess) {
            deferred.resolveWith(callbackContext, [success, statusText, jqXHR]);
          } else {
            deferred.rejectWith(callbackContext, [jqXHR, statusText, error]);
          }
          jqXHR.statusCode(statusCode);
          statusCode = undefined;
          if (fireGlobals) {
            globalEventContext.trigger(isSuccess ? "ajaxSuccess" : "ajaxError", [jqXHR, s, isSuccess ? success : error]);
          }
          completeDeferred.fireWith(callbackContext, [jqXHR, statusText]);
          if (fireGlobals) {
            globalEventContext.trigger("ajaxComplete", [jqXHR, s]);
            if (!--jQuery.active) {
              jQuery.event.trigger("ajaxStop");
            }
          }
        }
        return jqXHR;
      },
      getJSON: function(url, data, callback) {
        return jQuery.get(url, data, callback, "json");
      },
      getScript: function(url, callback) {
        return jQuery.get(url, undefined, callback, "script");
      }
    });
    jQuery.each(["get", "post"], function(_i, method) {
      jQuery[method] = function(url, data, callback, type) {
        if (isFunction(data)) {
          type = type || callback;
          callback = data;
          data = undefined;
        }
        return jQuery.ajax(jQuery.extend({
          url,
          type: method,
          dataType: type,
          data,
          success: callback
        }, jQuery.isPlainObject(url) && url));
      };
    });
    jQuery.ajaxPrefilter(function(s) {
      var i;
      for (i in s.headers) {
        if (i.toLowerCase() === "content-type") {
          s.contentType = s.headers[i] || "";
        }
      }
    });
    jQuery._evalUrl = function(url, options, doc) {
      return jQuery.ajax({
        url,
        type: "GET",
        dataType: "script",
        cache: true,
        async: false,
        global: false,
        converters: {
          "text script": function() {}
        },
        dataFilter: function(response) {
          jQuery.globalEval(response, options, doc);
        }
      });
    };
    jQuery.fn.extend({
      wrapAll: function(html) {
        var wrap;
        if (this[0]) {
          if (isFunction(html)) {
            html = html.call(this[0]);
          }
          wrap = jQuery(html, this[0].ownerDocument).eq(0).clone(true);
          if (this[0].parentNode) {
            wrap.insertBefore(this[0]);
          }
          wrap.map(function() {
            var elem = this;
            while (elem.firstElementChild) {
              elem = elem.firstElementChild;
            }
            return elem;
          }).append(this);
        }
        return this;
      },
      wrapInner: function(html) {
        if (isFunction(html)) {
          return this.each(function(i) {
            jQuery(this).wrapInner(html.call(this, i));
          });
        }
        return this.each(function() {
          var self = jQuery(this), contents = self.contents();
          if (contents.length) {
            contents.wrapAll(html);
          } else {
            self.append(html);
          }
        });
      },
      wrap: function(html) {
        var htmlIsFunction = isFunction(html);
        return this.each(function(i) {
          jQuery(this).wrapAll(htmlIsFunction ? html.call(this, i) : html);
        });
      },
      unwrap: function(selector) {
        this.parent(selector).not("body").each(function() {
          jQuery(this).replaceWith(this.childNodes);
        });
        return this;
      }
    });
    jQuery.expr.pseudos.hidden = function(elem) {
      return !jQuery.expr.pseudos.visible(elem);
    };
    jQuery.expr.pseudos.visible = function(elem) {
      return !!(elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length);
    };
    jQuery.ajaxSettings.xhr = function() {
      try {
        return new window2.XMLHttpRequest;
      } catch (e) {}
    };
    var xhrSuccessStatus = {
      0: 200,
      1223: 204
    }, xhrSupported = jQuery.ajaxSettings.xhr();
    support.cors = !!xhrSupported && "withCredentials" in xhrSupported;
    support.ajax = xhrSupported = !!xhrSupported;
    jQuery.ajaxTransport(function(options) {
      var callback, errorCallback;
      if (support.cors || xhrSupported && !options.crossDomain) {
        return {
          send: function(headers, complete) {
            var i, xhr = options.xhr();
            xhr.open(options.type, options.url, options.async, options.username, options.password);
            if (options.xhrFields) {
              for (i in options.xhrFields) {
                xhr[i] = options.xhrFields[i];
              }
            }
            if (options.mimeType && xhr.overrideMimeType) {
              xhr.overrideMimeType(options.mimeType);
            }
            if (!options.crossDomain && !headers["X-Requested-With"]) {
              headers["X-Requested-With"] = "XMLHttpRequest";
            }
            for (i in headers) {
              xhr.setRequestHeader(i, headers[i]);
            }
            callback = function(type) {
              return function() {
                if (callback) {
                  callback = errorCallback = xhr.onload = xhr.onerror = xhr.onabort = xhr.ontimeout = xhr.onreadystatechange = null;
                  if (type === "abort") {
                    xhr.abort();
                  } else if (type === "error") {
                    if (typeof xhr.status !== "number") {
                      complete(0, "error");
                    } else {
                      complete(xhr.status, xhr.statusText);
                    }
                  } else {
                    complete(xhrSuccessStatus[xhr.status] || xhr.status, xhr.statusText, (xhr.responseType || "text") !== "text" || typeof xhr.responseText !== "string" ? { binary: xhr.response } : { text: xhr.responseText }, xhr.getAllResponseHeaders());
                  }
                }
              };
            };
            xhr.onload = callback();
            errorCallback = xhr.onerror = xhr.ontimeout = callback("error");
            if (xhr.onabort !== undefined) {
              xhr.onabort = errorCallback;
            } else {
              xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                  window2.setTimeout(function() {
                    if (callback) {
                      errorCallback();
                    }
                  });
                }
              };
            }
            callback = callback("abort");
            try {
              xhr.send(options.hasContent && options.data || null);
            } catch (e) {
              if (callback) {
                throw e;
              }
            }
          },
          abort: function() {
            if (callback) {
              callback();
            }
          }
        };
      }
    });
    jQuery.ajaxPrefilter(function(s) {
      if (s.crossDomain) {
        s.contents.script = false;
      }
    });
    jQuery.ajaxSetup({
      accepts: {
        script: "text/javascript, application/javascript, " + "application/ecmascript, application/x-ecmascript"
      },
      contents: {
        script: /\b(?:java|ecma)script\b/
      },
      converters: {
        "text script": function(text) {
          jQuery.globalEval(text);
          return text;
        }
      }
    });
    jQuery.ajaxPrefilter("script", function(s) {
      if (s.cache === undefined) {
        s.cache = false;
      }
      if (s.crossDomain) {
        s.type = "GET";
      }
    });
    jQuery.ajaxTransport("script", function(s) {
      if (s.crossDomain || s.scriptAttrs) {
        var script, callback;
        return {
          send: function(_, complete) {
            script = jQuery("<script>").attr(s.scriptAttrs || {}).prop({ charset: s.scriptCharset, src: s.url }).on("load error", callback = function(evt) {
              script.remove();
              callback = null;
              if (evt) {
                complete(evt.type === "error" ? 404 : 200, evt.type);
              }
            });
            document2.head.appendChild(script[0]);
          },
          abort: function() {
            if (callback) {
              callback();
            }
          }
        };
      }
    });
    var oldCallbacks = [], rjsonp = /(=)\?(?=&|$)|\?\?/;
    jQuery.ajaxSetup({
      jsonp: "callback",
      jsonpCallback: function() {
        var callback = oldCallbacks.pop() || jQuery.expando + "_" + nonce.guid++;
        this[callback] = true;
        return callback;
      }
    });
    jQuery.ajaxPrefilter("json jsonp", function(s, originalSettings, jqXHR) {
      var callbackName, overwritten, responseContainer, jsonProp = s.jsonp !== false && (rjsonp.test(s.url) ? "url" : typeof s.data === "string" && (s.contentType || "").indexOf("application/x-www-form-urlencoded") === 0 && rjsonp.test(s.data) && "data");
      if (jsonProp || s.dataTypes[0] === "jsonp") {
        callbackName = s.jsonpCallback = isFunction(s.jsonpCallback) ? s.jsonpCallback() : s.jsonpCallback;
        if (jsonProp) {
          s[jsonProp] = s[jsonProp].replace(rjsonp, "$1" + callbackName);
        } else if (s.jsonp !== false) {
          s.url += (rquery.test(s.url) ? "&" : "?") + s.jsonp + "=" + callbackName;
        }
        s.converters["script json"] = function() {
          if (!responseContainer) {
            jQuery.error(callbackName + " was not called");
          }
          return responseContainer[0];
        };
        s.dataTypes[0] = "json";
        overwritten = window2[callbackName];
        window2[callbackName] = function() {
          responseContainer = arguments;
        };
        jqXHR.always(function() {
          if (overwritten === undefined) {
            jQuery(window2).removeProp(callbackName);
          } else {
            window2[callbackName] = overwritten;
          }
          if (s[callbackName]) {
            s.jsonpCallback = originalSettings.jsonpCallback;
            oldCallbacks.push(callbackName);
          }
          if (responseContainer && isFunction(overwritten)) {
            overwritten(responseContainer[0]);
          }
          responseContainer = overwritten = undefined;
        });
        return "script";
      }
    });
    support.createHTMLDocument = function() {
      var body = document2.implementation.createHTMLDocument("").body;
      body.innerHTML = "<form></form><form></form>";
      return body.childNodes.length === 2;
    }();
    jQuery.parseHTML = function(data, context, keepScripts) {
      if (typeof data !== "string") {
        return [];
      }
      if (typeof context === "boolean") {
        keepScripts = context;
        context = false;
      }
      var base, parsed, scripts;
      if (!context) {
        if (support.createHTMLDocument) {
          context = document2.implementation.createHTMLDocument("");
          base = context.createElement("base");
          base.href = document2.location.href;
          context.head.appendChild(base);
        } else {
          context = document2;
        }
      }
      parsed = rsingleTag.exec(data);
      scripts = !keepScripts && [];
      if (parsed) {
        return [context.createElement(parsed[1])];
      }
      parsed = buildFragment([data], context, scripts);
      if (scripts && scripts.length) {
        jQuery(scripts).remove();
      }
      return jQuery.merge([], parsed.childNodes);
    };
    jQuery.fn.load = function(url, params, callback) {
      var selector, type, response, self = this, off = url.indexOf(" ");
      if (off > -1) {
        selector = stripAndCollapse(url.slice(off));
        url = url.slice(0, off);
      }
      if (isFunction(params)) {
        callback = params;
        params = undefined;
      } else if (params && typeof params === "object") {
        type = "POST";
      }
      if (self.length > 0) {
        jQuery.ajax({
          url,
          type: type || "GET",
          dataType: "html",
          data: params
        }).done(function(responseText) {
          response = arguments;
          self.html(selector ? jQuery("<div>").append(jQuery.parseHTML(responseText)).find(selector) : responseText);
        }).always(callback && function(jqXHR, status) {
          self.each(function() {
            callback.apply(this, response || [jqXHR.responseText, status, jqXHR]);
          });
        });
      }
      return this;
    };
    jQuery.expr.pseudos.animated = function(elem) {
      return jQuery.grep(jQuery.timers, function(fn) {
        return elem === fn.elem;
      }).length;
    };
    jQuery.offset = {
      setOffset: function(elem, options, i) {
        var curPosition, curLeft, curCSSTop, curTop, curOffset, curCSSLeft, calculatePosition, position = jQuery.css(elem, "position"), curElem = jQuery(elem), props = {};
        if (position === "static") {
          elem.style.position = "relative";
        }
        curOffset = curElem.offset();
        curCSSTop = jQuery.css(elem, "top");
        curCSSLeft = jQuery.css(elem, "left");
        calculatePosition = (position === "absolute" || position === "fixed") && (curCSSTop + curCSSLeft).indexOf("auto") > -1;
        if (calculatePosition) {
          curPosition = curElem.position();
          curTop = curPosition.top;
          curLeft = curPosition.left;
        } else {
          curTop = parseFloat(curCSSTop) || 0;
          curLeft = parseFloat(curCSSLeft) || 0;
        }
        if (isFunction(options)) {
          options = options.call(elem, i, jQuery.extend({}, curOffset));
        }
        if (options.top != null) {
          props.top = options.top - curOffset.top + curTop;
        }
        if (options.left != null) {
          props.left = options.left - curOffset.left + curLeft;
        }
        if ("using" in options) {
          options.using.call(elem, props);
        } else {
          curElem.css(props);
        }
      }
    };
    jQuery.fn.extend({
      offset: function(options) {
        if (arguments.length) {
          return options === undefined ? this : this.each(function(i) {
            jQuery.offset.setOffset(this, options, i);
          });
        }
        var rect, win, elem = this[0];
        if (!elem) {
          return;
        }
        if (!elem.getClientRects().length) {
          return { top: 0, left: 0 };
        }
        rect = elem.getBoundingClientRect();
        win = elem.ownerDocument.defaultView;
        return {
          top: rect.top + win.pageYOffset,
          left: rect.left + win.pageXOffset
        };
      },
      position: function() {
        if (!this[0]) {
          return;
        }
        var offsetParent, offset, doc, elem = this[0], parentOffset = { top: 0, left: 0 };
        if (jQuery.css(elem, "position") === "fixed") {
          offset = elem.getBoundingClientRect();
        } else {
          offset = this.offset();
          doc = elem.ownerDocument;
          offsetParent = elem.offsetParent || doc.documentElement;
          while (offsetParent && (offsetParent === doc.body || offsetParent === doc.documentElement) && jQuery.css(offsetParent, "position") === "static") {
            offsetParent = offsetParent.parentNode;
          }
          if (offsetParent && offsetParent !== elem && offsetParent.nodeType === 1) {
            parentOffset = jQuery(offsetParent).offset();
            parentOffset.top += jQuery.css(offsetParent, "borderTopWidth", true);
            parentOffset.left += jQuery.css(offsetParent, "borderLeftWidth", true);
          }
        }
        return {
          top: offset.top - parentOffset.top - jQuery.css(elem, "marginTop", true),
          left: offset.left - parentOffset.left - jQuery.css(elem, "marginLeft", true)
        };
      },
      offsetParent: function() {
        return this.map(function() {
          var offsetParent = this.offsetParent;
          while (offsetParent && jQuery.css(offsetParent, "position") === "static") {
            offsetParent = offsetParent.offsetParent;
          }
          return offsetParent || documentElement;
        });
      }
    });
    jQuery.each({ scrollLeft: "pageXOffset", scrollTop: "pageYOffset" }, function(method, prop) {
      var top = prop === "pageYOffset";
      jQuery.fn[method] = function(val) {
        return access(this, function(elem, method, val) {
          var win;
          if (isWindow(elem)) {
            win = elem;
          } else if (elem.nodeType === 9) {
            win = elem.defaultView;
          }
          if (val === undefined) {
            return win ? win[prop] : elem[method];
          }
          if (win) {
            win.scrollTo(!top ? val : win.pageXOffset, top ? val : win.pageYOffset);
          } else {
            elem[method] = val;
          }
        }, method, val, arguments.length);
      };
    });
    jQuery.each(["top", "left"], function(_i, prop) {
      jQuery.cssHooks[prop] = addGetHookIf(support.pixelPosition, function(elem, computed) {
        if (computed) {
          computed = curCSS(elem, prop);
          return rnumnonpx.test(computed) ? jQuery(elem).position()[prop] + "px" : computed;
        }
      });
    });
    jQuery.each({ Height: "height", Width: "width" }, function(name, type) {
      jQuery.each({
        padding: "inner" + name,
        content: type,
        "": "outer" + name
      }, function(defaultExtra, funcName) {
        jQuery.fn[funcName] = function(margin, value) {
          var chainable = arguments.length && (defaultExtra || typeof margin !== "boolean"), extra = defaultExtra || (margin === true || value === true ? "margin" : "border");
          return access(this, function(elem, type, value) {
            var doc;
            if (isWindow(elem)) {
              return funcName.indexOf("outer") === 0 ? elem["inner" + name] : elem.document.documentElement["client" + name];
            }
            if (elem.nodeType === 9) {
              doc = elem.documentElement;
              return Math.max(elem.body["scroll" + name], doc["scroll" + name], elem.body["offset" + name], doc["offset" + name], doc["client" + name]);
            }
            return value === undefined ? jQuery.css(elem, type, extra) : jQuery.style(elem, type, value, extra);
          }, type, chainable ? margin : undefined, chainable);
        };
      });
    });
    jQuery.each([
      "ajaxStart",
      "ajaxStop",
      "ajaxComplete",
      "ajaxError",
      "ajaxSuccess",
      "ajaxSend"
    ], function(_i, type) {
      jQuery.fn[type] = function(fn) {
        return this.on(type, fn);
      };
    });
    jQuery.fn.extend({
      bind: function(types, data, fn) {
        return this.on(types, null, data, fn);
      },
      unbind: function(types, fn) {
        return this.off(types, null, fn);
      },
      delegate: function(selector, types, data, fn) {
        return this.on(types, selector, data, fn);
      },
      undelegate: function(selector, types, fn) {
        return arguments.length === 1 ? this.off(selector, "**") : this.off(types, selector || "**", fn);
      },
      hover: function(fnOver, fnOut) {
        return this.on("mouseenter", fnOver).on("mouseleave", fnOut || fnOver);
      }
    });
    jQuery.each(("blur focus focusin focusout resize scroll click dblclick " + "mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " + "change select submit keydown keypress keyup contextmenu").split(" "), function(_i, name) {
      jQuery.fn[name] = function(data, fn) {
        return arguments.length > 0 ? this.on(name, null, data, fn) : this.trigger(name);
      };
    });
    var rtrim = /^[\s\uFEFF\xA0]+|([^\s\uFEFF\xA0])[\s\uFEFF\xA0]+$/g;
    jQuery.proxy = function(fn, context) {
      var tmp, args, proxy;
      if (typeof context === "string") {
        tmp = fn[context];
        context = fn;
        fn = tmp;
      }
      if (!isFunction(fn)) {
        return;
      }
      args = slice.call(arguments, 2);
      proxy = function() {
        return fn.apply(context || this, args.concat(slice.call(arguments)));
      };
      proxy.guid = fn.guid = fn.guid || jQuery.guid++;
      return proxy;
    };
    jQuery.holdReady = function(hold) {
      if (hold) {
        jQuery.readyWait++;
      } else {
        jQuery.ready(true);
      }
    };
    jQuery.isArray = Array.isArray;
    jQuery.parseJSON = JSON.parse;
    jQuery.nodeName = nodeName;
    jQuery.isFunction = isFunction;
    jQuery.isWindow = isWindow;
    jQuery.camelCase = camelCase;
    jQuery.type = toType;
    jQuery.now = Date.now;
    jQuery.isNumeric = function(obj) {
      var type = jQuery.type(obj);
      return (type === "number" || type === "string") && !isNaN(obj - parseFloat(obj));
    };
    jQuery.trim = function(text) {
      return text == null ? "" : (text + "").replace(rtrim, "$1");
    };
    if (typeof define === "function" && define.amd) {
      define("jquery", [], function() {
        return jQuery;
      });
    }
    var { jQuery: _jQuery, $: _$ } = window2;
    jQuery.noConflict = function(deep) {
      if (window2.$ === jQuery) {
        window2.$ = _$;
      }
      if (deep && window2.jQuery === jQuery) {
        window2.jQuery = _jQuery;
      }
      return jQuery;
    };
    if (typeof noGlobal === "undefined") {
      window2.jQuery = window2.$ = jQuery;
    }
    return jQuery;
  });
});

// src/frontend/index.js
var import_jquery2 = __toESM(require_jquery(), 1);

// src/frontend/style.css
var style_default = `/* Worldhopper Engine for Lumiverse. Colors come from the Lumiverse theme, so it follows whatever theme is on.
   Teal is you, violet someone else, warm gold someone back in their own body, grey empty. */
.wh-ui {
    --wh-accent: var(--lumiverse-primary, #e18a24);
    --wh-line: var(--lumiverse-border, rgba(255, 255, 255, 0.14));
    --wh-text: var(--lumiverse-text, #eee);
    --wh-panel: var(--lumiverse-bg-elevated, rgba(24, 24, 24, 0.95));
    --wh-you: 29, 158, 117;
    --wh-npc: 127, 119, 221;
    --wh-back: 214, 160, 72;
    --wh-idle: 150, 150, 160;
    color: var(--wh-text);
}
.wh-i { width: 1em; height: 1em; flex: none; vertical-align: -0.125em; display: inline-block; }
.wh-spin { animation: wh-spin 0.9s linear infinite; }
@keyframes wh-spin { to { transform: rotate(360deg); } }

/* Buttons, fields and checkboxes, in Lumiverse's shape. */
.wh-ui .menu_button {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 5px 10px; margin: 0; border-radius: 8px;
    border: 1px solid var(--wh-line); background: var(--lumiverse-fill-subtle, rgba(255, 255, 255, 0.04));
    color: inherit; font: inherit; font-size: 0.9em; cursor: pointer; user-select: none;
    transition: background 0.12s, border-color 0.12s;
}
.wh-ui .menu_button:hover { border-color: var(--lumiverse-border-hover, var(--wh-accent)); background: var(--lumiverse-primary-010, rgba(255, 255, 255, 0.08)); }
.wh-ui .menu_button_icon { width: 30px; height: 30px; padding: 0; }
.wh-ui .menu_button.wh-on { color: var(--wh-accent); border-color: var(--wh-accent); }
.wh-ui .text_pole {
    width: 100%; box-sizing: border-box; margin: 0; padding: 6px 9px; border-radius: 8px;
    border: 1px solid var(--wh-line); background: var(--lumiverse-bg-deep, rgba(0, 0, 0, 0.25));
    color: inherit; font: inherit; font-size: 0.92em;
}
.wh-ui .text_pole:focus { outline: none; border-color: var(--wh-accent); }
.wh-ui textarea.text_pole { resize: vertical; }
.wh-ui .checkbox_label { display: flex; align-items: center; gap: 7px; cursor: pointer; }
.wh-ui .checkbox_label input { accent-color: var(--wh-accent); }

/* ------------------------------------------------------------------ the panel (drawer tab) */
.wh-panel { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 16px; font-size: 0.95em; }
.wh-panel .wh-top { display: flex; align-items: center; gap: 8px; }
.wh-panel .wh-brand { display: flex; align-items: center; gap: 7px; font-weight: 700; font-size: 1.05em; }
.wh-panel .wh-brand .wh-i { color: var(--wh-accent); }
.wh-panel .wh-card { padding: 9px 11px; border: 1px solid var(--wh-line); border-radius: 10px; background: rgba(0, 0, 0, 0.12); }
.wh-panel .wh-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 28px; }
.wh-panel .wh-title { display: flex; align-items: center; gap: 7px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wh-panel .wh-title > .wh-i { color: var(--wh-accent); }
.wh-panel .wh-sub { font-weight: 400; opacity: 0.6; }
.wh-panel .wh-tools { display: flex; gap: 4px; flex-shrink: 0; align-items: center; }
.wh-panel .wh-picked { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.wh-panel .wh-chip {
    --wh-g: var(--wh-accent);
    padding: 1px 10px; border-radius: 999px; border: 1px solid var(--wh-g);
    background: color-mix(in srgb, var(--wh-g) 22%, transparent); font-size: 0.9em; cursor: pointer;
}
.wh-ui .wh-g-occupancy { --wh-g: #9b8cff; }
.wh-ui .wh-g-overwrite { --wh-g: #e46a9a; }
.wh-ui .wh-g-reduction { --wh-g: #d9a24a; }
.wh-ui .wh-g-other { --wh-g: #5fb7a4; }
.wh-panel .wh-empty { opacity: 0.6; font-size: 0.9em; }
.wh-panel .wh-suggestion { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 6px; font-size: 0.9em; }
.wh-panel .wh-suggestion .menu_button { padding: 2px 10px; }
.wh-ui .wh-modes { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.wh-ui .wh-mode-group { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.wh-ui .wh-mode-group-title { width: 100%; font-size: 0.75em; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.05em; color: var(--wh-g); }
.wh-ui .wh-pills { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0; }
.wh-ui .wh-pill {
    display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--wh-line);
    font-size: 0.88em; cursor: pointer; user-select: none; opacity: 0.75; transition: background 0.12s, border-color 0.12s, opacity 0.12s;
}
.wh-ui .wh-pill input { display: none; }
.wh-ui .wh-pill:has(input:checked) { opacity: 1; border-color: var(--wh-g, var(--wh-accent)); background: color-mix(in srgb, var(--wh-g, var(--wh-accent)) 22%, transparent); }
.wh-ui .wh-pill.wh-modifier { border-style: dashed; }
.wh-ui .wh-pill:has(input:disabled) { opacity: 0.35; cursor: default; }
.wh-panel .wh-box { display: flex; flex-direction: column; gap: 5px; margin-top: 6px; font-size: 0.9em; }
.wh-panel .wh-box.wh-history { margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--wh-line); }
.wh-panel .wh-row { min-width: 0; padding-left: 8px; border-left: 3px solid transparent; }
.wh-panel .wh-row.wh-expandable { cursor: pointer; }
.wh-panel .wh-row-main { display: flex; align-items: center; gap: 5px; font-weight: 500; }
.wh-panel .wh-row-main .wh-i { opacity: 0.7; font-size: 0.85em; }
.wh-panel .wh-row-sub { font-size: 0.88em; opacity: 0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wh-panel .wh-row.wh-open .wh-row-sub, .wh-panel .wh-row-sub.wh-extra { white-space: normal; }
.wh-panel .wh-row.wh-k-you { border-left-color: rgba(var(--wh-you), 0.9); }
.wh-panel .wh-row.wh-k-npc { border-left-color: rgba(var(--wh-npc), 0.9); }
.wh-panel .wh-row.wh-k-idle { border-left: 3px dashed rgba(255, 255, 255, 0.25); }
.wh-panel .wh-mini-title { font-size: 0.75em; opacity: 0.55; text-transform: uppercase; letter-spacing: 0.05em; }
.wh-panel .wh-status { display: flex; flex-direction: column; opacity: 0.55; font-size: 0.85em; padding: 0 2px; }
.wh-panel .wh-status small:empty { display: none; }
.wh-panel .wh-key { display: inline-block; width: 10px; height: 10px; border-radius: 3px; vertical-align: -1px; }
.wh-panel .wh-key-you { background: rgb(var(--wh-you)); }
.wh-panel .wh-key-npc { background: rgb(var(--wh-npc)); }
.wh-panel .wh-blurb { margin-top: 6px; font-size: 0.86em; opacity: 0.85; }

/* Settings: a fold, one section per job, every option explained where you can see it. */
.wh-panel details.wh-settings > summary { cursor: pointer; display: flex; align-items: center; gap: 7px; padding: 6px 2px; opacity: 0.85; list-style: none; }
.wh-panel details.wh-settings > summary::-webkit-details-marker { display: none; }
.wh-panel .wh-section { margin-top: 10px; padding: 8px 10px 10px; border: 1px solid var(--wh-line); border-radius: 10px; background: rgba(0, 0, 0, 0.12); }
.wh-panel .wh-group { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font-weight: 600; font-size: 0.95em; }
.wh-panel .wh-group > .wh-i:first-child { color: var(--wh-accent); }
.wh-panel .wh-group .wh-help-toggle { margin-left: auto; font-weight: 400; }
.wh-panel .wh-tip {
    display: flex; align-items: flex-start; gap: 8px; margin: 2px 0 6px; padding: 6px 9px; border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--wh-accent) 45%, transparent); background: color-mix(in srgb, var(--wh-accent) 10%, transparent);
    font-size: 0.85em; line-height: 1.3;
}
.wh-panel .wh-tip > .wh-i { margin-top: 2px; color: var(--wh-accent); }
.wh-panel .wh-switches { display: flex; flex-direction: column; gap: 2px; }
.wh-panel .wh-switch { display: flex; align-items: flex-start; gap: 10px; margin: 0; padding: 6px; border-radius: 8px; cursor: pointer; }
.wh-panel .wh-switch:hover { background: rgba(255, 255, 255, 0.04); }
.wh-panel .wh-switch > span { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
.wh-panel .wh-switch b { font-weight: 500; }
.wh-panel .wh-switch small { margin-top: 2px; font-size: 0.8em; opacity: 0.62; }
.wh-panel .wh-switch input[type='checkbox'] {
    appearance: none; position: relative; flex: none; width: 34px; height: 20px; margin: 1px 0 0; border-radius: 999px;
    border: 1px solid var(--wh-line); background: rgba(255, 255, 255, 0.14); cursor: pointer; transition: background-color 0.15s, border-color 0.15s;
}
.wh-panel .wh-switch input[type='checkbox']::before {
    content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #f2eef0; transition: transform 0.15s ease;
}
.wh-panel .wh-switch input[type='checkbox']:checked { background: var(--wh-accent); border-color: var(--wh-accent); }
.wh-panel .wh-switch input[type='checkbox']:checked::before { transform: translateX(14px); }
.wh-panel .wh-switch.wh-power { margin: 0 0 0 auto; padding: 0; align-items: center; }
.wh-panel .wh-switch.wh-power:hover { background: none; }
.wh-panel .wh-field { display: flex; flex-direction: column; gap: 4px; margin: 8px 0 4px; }
.wh-panel .wh-field > span { display: flex; flex-direction: column; }
.wh-panel .wh-field > span b { font-weight: 500; }
.wh-panel .wh-field > span small { font-size: 0.8em; opacity: 0.62; line-height: 1.25; }
.wh-panel .wh-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.wh-panel .wh-wide-button { width: fit-content; margin: 8px 0 0; }
.wh-panel .wh-help-toggle { cursor: pointer; opacity: 0.55; padding: 2px; display: inline-flex; }
.wh-panel .wh-help-toggle:hover, .wh-panel .wh-help-toggle.wh-on { opacity: 1; color: var(--wh-accent); }
.wh-panel .wh-help {
    display: none; margin: 6px 0 4px; padding: 6px 10px; border-left: 2px solid var(--wh-accent); border-radius: 0 6px 6px 0;
    background: color-mix(in srgb, var(--wh-accent) 8%, transparent); font-size: 0.86em; line-height: 1.45; opacity: 0.9;
}
.wh-panel .wh-help.wh-open { display: block; }
.wh-ui .wh-warning {
    margin: 6px 0; padding: 5px 10px; border-radius: 6px; font-size: 0.86em;
    border: 1px solid color-mix(in srgb, var(--lumiverse-warning, #e0a030) 60%, transparent);
    background: color-mix(in srgb, var(--lumiverse-warning, #e0a030) 10%, transparent);
}

/* ------------------------------------------------------------------ the bars above the chat */
.wh-docks { display: flex; flex-direction: column; gap: 4px; width: 100%; }
.wh-ledger-strip {
    display: flex; align-items: center; gap: 8px; flex-shrink: 0; min-height: 46px;
    overflow-x: auto; overflow-y: hidden; white-space: nowrap; scrollbar-width: none;
    padding: 6px 8px; cursor: pointer; border: 1px solid var(--wh-line); border-radius: 12px;
    background: color-mix(in srgb, var(--wh-panel) 92%, transparent); backdrop-filter: blur(8px);
}
.wh-ledger-strip::-webkit-scrollbar { display: none; }
.wh-ledger-strip .wh-chip {
    display: inline-flex; align-items: center; gap: 9px; flex-shrink: 0; height: 34px; padding: 0 14px 0 11px;
    border-radius: 17px; border: 1px solid rgba(255, 255, 255, 0.14); background: rgba(255, 255, 255, 0.04);
}
.wh-ledger-strip .wh-chip > .wh-i { font-size: 15px; opacity: 0.85; }
.wh-ledger-strip .wh-chip.wh-has-face { padding-left: 3px; }
.wh-ledger-strip .wh-chip-face { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; object-position: 50% 22%; flex: none; border: 1.5px solid rgba(255, 255, 255, 0.3); }
.wh-ledger-strip .wh-chip.wh-you .wh-chip-face { border-color: rgb(var(--wh-you)); }
.wh-ledger-strip .wh-chip.wh-npc .wh-chip-face { border-color: rgb(var(--wh-npc)); }
.wh-ledger-strip .wh-chip-text { display: flex; flex-direction: column; justify-content: center; line-height: 1.2; }
.wh-ledger-strip .wh-chip-text b { font-weight: 600; font-size: 13px; }
.wh-ledger-strip .wh-chip-text small { font-size: 11px; opacity: 0.7; display: inline-flex; align-items: center; gap: 3px; }
.wh-ledger-strip .wh-chip.wh-you { border-color: rgba(var(--wh-you), 0.95); background: rgba(var(--wh-you), 0.22); }
.wh-ledger-strip .wh-chip.wh-you > .wh-i { color: rgb(var(--wh-you)); opacity: 1; }
.wh-ledger-strip .wh-chip.wh-npc { border-color: rgba(var(--wh-npc), 0.6); background: rgba(var(--wh-npc), 0.14); }
.wh-ledger-strip .wh-chip.wh-npc > .wh-i { color: rgb(var(--wh-npc)); opacity: 1; }
.wh-ledger-strip .wh-chip.wh-empty, .wh-ledger-strip .wh-chip.wh-mind, .wh-ledger-strip .wh-chip.wh-hidden { border-style: dashed; }
.wh-ledger-strip .wh-chip.wh-hidden .wh-chip-text { font-style: italic; }
.wh-ledger-strip .wh-busy { opacity: 0.55; font-style: italic; font-size: 0.8em; }
.wh-ledger-strip .wh-strip-label { flex-shrink: 0; width: 22px; text-align: center; font-size: 15px; opacity: 0.6; display: inline-flex; justify-content: center; }

/* "as (name)" next to your name when you're in someone else's body. */
.wh-as {
    display: inline-flex; align-items: center; gap: 5px; margin-left: 8px; padding: 1px 10px; border-radius: 999px;
    border: 1px solid rgba(29, 158, 117, 0.95); background: rgba(29, 158, 117, 0.22); color: var(--lumiverse-text, #eee);
    font-size: 0.78em; font-weight: 600; white-space: nowrap; align-self: center; vertical-align: middle;
}
.wh-as .wh-i { color: rgb(29, 158, 117); }

/* ⟲ on a reply the checks changed. */
.wh-undo {
    display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px;
    border: none; background: none; color: inherit; cursor: pointer; opacity: 0.8;
}
.wh-undo:hover { opacity: 1; background: var(--lumiverse-primary-010, rgba(255, 255, 255, 0.08)); }
.wh-undo.wh-showing-original { color: var(--lumiverse-warning, #e0a030); }

/* ------------------------------------------------------------------ the body roster over the message box */
.wh-lanes { display: flex; flex-wrap: wrap; align-items: stretch; gap: 6px; width: 100%; max-height: 132px; overflow-y: auto; padding: 4px 4px 6px; box-sizing: border-box; }
.wh-lane-card {
    --wh-hue: 29, 158, 117;
    flex: 1 1 150px; max-width: 240px; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
    padding: 4px 10px 5px; border-radius: 10px; border: 1px solid rgba(var(--wh-hue), 0.45); background: rgba(var(--wh-hue), 0.09);
    color: var(--lumiverse-text, #eee); font: inherit; text-align: left; cursor: pointer; transition: background-color 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.wh-lane-card:hover, .wh-lane-card:focus-visible { background: rgba(var(--wh-hue), 0.18); outline: none; }
.wh-lane-card.wh-has { background: rgba(var(--wh-hue), 0.2); }
.wh-lane-card.wh-on { border-color: rgb(var(--wh-hue)); box-shadow: inset 0 0 0 1px rgb(var(--wh-hue)); }
.wh-lane-top { display: flex; align-items: center; gap: 6px; max-width: 100%; font-size: 0.85em; }
.wh-lane-top b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wh-lane-top small { opacity: 0.65; }
.wh-lane-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: rgb(var(--wh-hue)); }
.wh-lane-status { max-width: 100%; font-size: 0.72em; opacity: 0.75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wh-lanes.wh-compact .wh-lane-card { flex: 0 0 auto; padding: 3px 12px; border-radius: 999px; }
.wh-lanes.wh-compact .wh-lane-status { display: none; }
.wh-lanes-size { align-self: center; margin-left: auto; padding: 4px 6px; border: none; background: none; color: inherit; opacity: 0.5; cursor: pointer; display: inline-flex; }
.wh-lanes-size:hover { opacity: 0.9; }

/* ------------------------------------------------------------------ in the messages
   Your body lines (the WH - Body lines script) and the moment boxes (WH - Possession, WH - Release, WH - Moments). */
.wh-lane {
    --wh-hue: 29, 158, 117;
    margin: 0.3em 0; padding: 0.15em 0.6em; border-left: 3px solid rgba(var(--wh-hue), 0.85); border-radius: 0 6px 6px 0; background: rgba(var(--wh-hue), 0.07);
}
.wh-lane > p { margin: 0; }
.wh-lane-name {
    display: inline-block; margin-right: 0.45em; padding: 0 0.6em; border-radius: 999px; border: 1px solid rgba(var(--wh-hue), 0.7);
    background: rgba(var(--wh-hue), 0.2); font-size: 0.8em; font-weight: 600; font-style: normal; vertical-align: 0.08em;
}
.wh-possess, .wh-release, .wh-moment {
    --wh-mc: 178, 126, 255;
    position: relative; margin: 1.35em 0 0.9em; padding: 0.95em 1.1em 0.65em; border-radius: 14px;
    border: 1px solid rgba(var(--wh-mc), 0.38); background: rgba(var(--wh-mc), 0.07); box-shadow: 0 0 22px rgba(var(--wh-mc), 0.1);
}
.wh-possess::before, .wh-release::before, .wh-moment::before {
    position: absolute; top: -0.85em; left: 14px; padding: 0.15em 0.8em; border-radius: 999px; border: 1px solid rgba(var(--wh-mc), 0.45);
    background: linear-gradient(rgba(var(--wh-mc), 0.14), rgba(var(--wh-mc), 0.14)), var(--lumiverse-bg-elevated, rgb(23, 23, 23));
    color: color-mix(in srgb, rgb(var(--wh-mc)) 72%, var(--lumiverse-text, currentColor));
    font-size: 0.62em; font-style: normal; font-weight: 600; line-height: 1.5; letter-spacing: 0.22em; text-transform: uppercase; white-space: nowrap;
}
.wh-possess > p:last-child, .wh-release > p:last-child, .wh-moment > p:last-child { margin-bottom: 0; }
.wh-possess { background: linear-gradient(135deg, rgba(118, 70, 230, 0.14), rgba(214, 64, 170, 0.08)); }
.wh-possess::before { content: '◈ possession'; }
.wh-release { --wh-mc: 165, 158, 195; border-style: dashed; background: rgba(var(--wh-mc), 0.05); box-shadow: none; }
.wh-release::before { content: '◇ release'; }
.wh-m-absorbed { --wh-mc: 239, 159, 39; background: linear-gradient(135deg, rgba(186, 117, 23, 0.14), rgba(239, 159, 39, 0.05)); }
.wh-m-absorbed::before { content: '⬡ absorbed'; }
.wh-m-worn { --wh-mc: 240, 153, 123; border: 1.5px dashed rgba(var(--wh-mc), 0.55); }
.wh-m-worn::before { content: '❖ worn'; }
.wh-m-shed { --wh-mc: 240, 153, 123; border: 1.5px dotted rgba(var(--wh-mc), 0.4); background: rgba(var(--wh-mc), 0.04); box-shadow: none; }
.wh-m-shed::before { content: '◇ stepped out'; }
.wh-m-trance { --wh-mc: 133, 183, 235; border: 3px double rgba(var(--wh-mc), 0.5); background: radial-gradient(ellipse at center, rgba(55, 138, 221, 0.14), rgba(55, 138, 221, 0.04)); }
.wh-m-trance::before { content: '◎ trance'; }
.wh-m-control { --wh-mc: 212, 83, 126; border-left: 4px solid rgba(var(--wh-mc), 0.9); }
.wh-m-control::before { content: '✦ control'; }
.wh-m-timestop { --wh-mc: 172, 170, 162; filter: grayscale(1); }
.wh-m-timestop::before { content: '❚❚ time stops'; }
.wh-m-resume { --wh-mc: 172, 170, 162; border-style: dashed; background: rgba(var(--wh-mc), 0.04); box-shadow: none; }
.wh-m-resume::before { content: '▶ time resumes'; }
.wh-m-swap { --wh-mc: 99, 183, 160; border: 1.5px solid rgba(var(--wh-mc), 0.5); background: linear-gradient(90deg, rgba(var(--wh-mc), 0.12), rgba(var(--wh-mc), 0.03), rgba(var(--wh-mc), 0.12)); }
.wh-m-swap::before { content: '⇄ swap'; }
.wh-m-transform { --wh-mc: 163, 196, 74; border: 1.5px solid rgba(var(--wh-mc), 0.5); background: linear-gradient(160deg, rgba(var(--wh-mc), 0.16), rgba(var(--wh-mc), 0.03)); }
.wh-m-transform::before { content: '✧ transformation'; }
/* The newest one arrives with a ripple; older ones sit still. */
.wh-fresh.wh-possess { animation: wh-possess-in 1.6s ease-out; }
.wh-fresh.wh-release { animation: wh-release-in 1.2s ease-out; }
.wh-fresh.wh-moment { animation: wh-moment-in 1.2s ease-out; }
.wh-fresh.wh-m-trance { animation: wh-trance-in 2.2s ease-out; }
.wh-fresh.wh-m-timestop { animation: wh-timestop-in 0.9s steps(6, end); }
@keyframes wh-possess-in {
    0% { opacity: 0; filter: blur(3px) hue-rotate(-40deg); }
    45% { opacity: 1; filter: blur(0.5px) hue-rotate(20deg); box-shadow: inset 0 0 44px rgba(170, 100, 255, 0.4), 0 0 30px rgba(210, 90, 255, 0.4); }
    100% { filter: none; }
}
@keyframes wh-release-in { from { opacity: 0; filter: grayscale(1) blur(2px); } to { opacity: 1; filter: none; } }
@keyframes wh-moment-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes wh-trance-in { 0% { opacity: 0; filter: blur(2px); } 40% { opacity: 1; filter: blur(0.6px); box-shadow: 0 0 26px rgba(133, 183, 235, 0.35); } 100% { filter: none; box-shadow: none; } }
@keyframes wh-timestop-in { from { opacity: 0.2; filter: grayscale(0); } to { opacity: 1; filter: grayscale(1); } }
@media (prefers-reduced-motion: reduce) { .wh-fresh { animation: none !important; } .wh-spin { animation: none; } }

/* ------------------------------------------------------------------ Check card */
.wh-cardtool { text-align: left; }
.wh-cardtool .wh-muted { opacity: 0.65; }
.wh-cardtool .wh-mini-title { margin: 12px 0 4px; font-size: 0.75em; opacity: 0.55; text-transform: uppercase; letter-spacing: 0.05em; }
.wh-cardtool .wh-doctor { display: flex; flex-direction: column; gap: 4px; margin: 8px 0; }
.wh-cardtool .wh-doctor-ok { opacity: 0.8; display: flex; gap: 6px; align-items: center; }
.wh-cardtool .wh-doctor-ok .wh-i { color: rgb(29, 158, 117); }
.wh-cardtool .wh-doctor-item { border: 1px solid var(--wh-line); border-radius: 6px; }
.wh-cardtool .wh-doctor-item > summary { display: flex; gap: 8px; align-items: baseline; padding: 4px 10px; cursor: pointer; list-style: none; }
.wh-cardtool .wh-doctor-item > summary::-webkit-details-marker { display: none; }
.wh-cardtool .wh-doctor-item.wh-warn > summary .wh-i { color: var(--lumiverse-warning, #e0a030); }
.wh-cardtool .wh-doctor-item.wh-info > summary .wh-i { opacity: 0.6; }
.wh-cardtool .wh-doctor-detail { padding: 0 10px 8px 32px; opacity: 0.8; font-size: 0.92em; }
.wh-cardtool .wh-doctor-detail q { display: block; margin-bottom: 4px; font-style: italic; opacity: 0.9; }
.wh-cardtool .wh-card-review { width: fit-content; margin-top: 6px; }
.wh-cardtool .wh-card-review-out { white-space: pre-wrap; margin-top: 8px; line-height: 1.45; }
.wh-cardtool .wh-card-review-out:empty { display: none; }

/* A modal's own small form (a persona's description, a look). */
.wh-ask { display: flex; flex-direction: column; gap: 10px; padding: 4px 2px; }
.wh-ask .wh-ask-actions { display: flex; justify-content: flex-end; gap: 6px; }

/* ------------------------------------------------------------------ the Ledger and Mind Book views (tap a bar) */
.wh-dos { --wh-card: color-mix(in srgb, var(--wh-text) 4%, transparent); text-align: left; display: flex; flex-direction: column; gap: 10px; padding: 2px; }
.wh-dos .wh-dos-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--wh-line); }
.wh-dos .wh-dos-title { margin: 0; font-size: 1.2em; display: flex; align-items: center; gap: 8px; }
.wh-dos .wh-dos-title .wh-i { color: var(--wh-accent); }
.wh-dos .wh-dos-sub { display: block; opacity: 0.65; margin-top: 2px; }
.wh-dos .wh-dos-section { display: flex; align-items: center; gap: 7px; margin-top: 4px; font-size: 0.78em; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.75; }
.wh-dos .wh-dos-section .wh-i { color: var(--wh-accent); opacity: 0.9; }
.wh-dos .wh-dos-count { font-size: 0.9em; letter-spacing: 0; padding: 0 7px; border-radius: 999px; background: color-mix(in srgb, var(--wh-accent) 20%, transparent); }
.wh-dos .wh-dos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 270px), 1fr)); gap: 10px; }
.wh-dos .wh-dos-card {
    --k: var(--wh-idle);
    display: flex; flex-direction: column; gap: 9px; padding: 12px; border: 1px solid var(--wh-line); border-top: 3px solid rgba(var(--k), 0.85);
    border-radius: 12px; background: linear-gradient(180deg, rgba(var(--k), 0.10), transparent 70%), var(--wh-card);
}
.wh-dos .wh-dos-k-you { --k: var(--wh-you); }
.wh-dos .wh-dos-k-npc { --k: var(--wh-npc); }
.wh-dos .wh-dos-k-back { --k: var(--wh-back); }
.wh-dos .wh-dos-k-idle, .wh-dos .wh-dos-k-mind { --k: var(--wh-idle); }
.wh-dos .wh-dos-card-head { display: flex; gap: 11px; align-items: center; }
.wh-dos .wh-dos-avatar {
    --k: var(--wh-idle);
    position: relative; flex: none; width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center; overflow: visible;
    font-size: 1.35em; font-weight: 700; color: rgb(var(--k));
    background: radial-gradient(circle at 35% 30%, rgba(var(--k), 0.35), rgba(var(--k), 0.12));
    border: 2px solid rgba(var(--k), 0.75); box-shadow: 0 0 0 3px rgba(var(--k), 0.12);
}
.wh-dos .wh-dos-avatar.wh-dos-k-you { --k: var(--wh-you); }
.wh-dos .wh-dos-avatar.wh-dos-k-npc { --k: var(--wh-npc); }
.wh-dos .wh-dos-avatar.wh-dos-k-back { --k: var(--wh-back); }
.wh-dos .wh-dos-avatar img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%; border-radius: 50%; }
.wh-dos .wh-dos-avatar.wh-dos-pic { cursor: pointer; }
.wh-dos .wh-dos-avatar.wh-dos-pic:hover, .wh-dos .wh-dos-avatar.wh-dos-pic:focus-visible { box-shadow: 0 0 0 3px rgba(var(--k), 0.35); outline: none; }
.wh-dos .wh-dos-badge {
    position: absolute; right: -3px; bottom: -3px; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 10px;
    background: var(--wh-panel); border: 1px solid rgba(var(--k), 0.7); color: rgb(var(--k)); opacity: 0; transition: opacity 0.15s;
}
.wh-dos .wh-dos-card:hover .wh-dos-badge, .wh-dos .wh-dos-avatar:focus-visible .wh-dos-badge { opacity: 1; }
.wh-dos .wh-dos-avatar:not(:has(img)) .wh-dos-badge { opacity: 0.85; }
@media (hover: none) { .wh-dos .wh-dos-badge { opacity: 0.85; } }
.wh-dos .wh-dos-spin { position: absolute; inset: 0; display: grid; place-items: center; border-radius: 50%; background: rgba(0, 0, 0, 0.45); color: #fff; }
.wh-dos .wh-dos-titles { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.wh-dos .wh-dos-name { font-size: 1.1em; font-weight: 700; line-height: 1.2; overflow-wrap: anywhere; }
.wh-dos .wh-dos-pron { font-weight: 400; opacity: 0.6; margin-left: 6px; font-size: 0.8em; }
.wh-dos .wh-dos-pills { display: flex; flex-wrap: wrap; gap: 5px; }
.wh-dos .wh-dos-pill { --k: var(--wh-idle); display: inline-flex; align-items: center; gap: 4px; font-size: 0.78em; line-height: 1.5; padding: 0 8px; border-radius: 999px; white-space: nowrap; border: 1px solid rgba(var(--k), 0.55); background: rgba(var(--k), 0.16); }
.wh-dos .wh-dos-pill.wh-dos-k-you { --k: var(--wh-you); }
.wh-dos .wh-dos-pill.wh-dos-k-npc { --k: var(--wh-npc); }
.wh-dos .wh-dos-pill.wh-dos-k-back { --k: var(--wh-back); }
.wh-dos .wh-dos-pill.wh-dos-soft { border-color: var(--wh-line); background: transparent; opacity: 0.85; }
.wh-dos .wh-dos-pill.wh-dos-hidden { border-style: dashed; background: transparent; opacity: 0.85; }
.wh-dos .wh-dos-pill.wh-dos-warn { --k: 226, 75, 74; }
.wh-dos .wh-dos-facts { display: flex; flex-direction: column; gap: 3px; font-size: 0.9em; }
.wh-dos .wh-dos-fact { display: flex; gap: 8px; align-items: baseline; }
.wh-dos .wh-dos-fact .wh-i { opacity: 0.6; flex: none; }
.wh-dos .wh-dos-faint { opacity: 0.6; }
.wh-dos .wh-dos-sheet { display: flex; flex-direction: column; gap: 5px; padding: 9px 10px; border-radius: 9px; background: color-mix(in srgb, var(--wh-text) 5%, transparent); border-left: 2px solid rgba(var(--k), 0.6); font-size: 0.88em; line-height: 1.45; }
.wh-dos .wh-dos-label { color: var(--wh-accent); font-weight: 700; margin-right: 6px; }
.wh-dos .wh-dos-note { font-size: 0.85em; opacity: 0.6; font-style: italic; }
.wh-dos .wh-dos-busy { font-style: normal; opacity: 0.85; display: flex; gap: 6px; align-items: center; }
.wh-dos .wh-dos-empty { display: flex; align-items: center; gap: 10px; padding: 14px; border: 1px dashed var(--wh-line); border-radius: 12px; opacity: 0.75; }
.wh-dos .wh-dos-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.wh-dos .wh-dos-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 0.88em; border: 1px solid var(--wh-line); background: var(--wh-card); }
.wh-dos .wh-dos-chip .wh-i { color: var(--wh-accent); opacity: 0.85; }
.wh-dos .wh-dos-timeline { list-style: none; margin: 0; padding: 0 0 0 18px; position: relative; }
.wh-dos .wh-dos-timeline::before { content: ""; position: absolute; left: 6px; top: 6px; bottom: 6px; width: 2px; background: var(--wh-line); }
.wh-dos .wh-dos-timeline li { position: relative; padding: 2px 0 10px 8px; }
.wh-dos .wh-dos-timeline li::before { content: ""; position: absolute; left: -16px; top: 6px; width: 10px; height: 10px; border-radius: 50%; background: var(--wh-panel); border: 2px solid var(--wh-accent); }
.wh-dos .wh-dos-timeline li.wh-dos-now::before { background: var(--wh-accent); }
.wh-dos .wh-dos-tl-title { font-weight: 700; display: flex; gap: 6px; align-items: center; }
.wh-dos .wh-dos-tl-line { font-size: 0.88em; opacity: 0.85; }
.wh-dos .wh-dos-more > summary { cursor: pointer; opacity: 0.8; padding: 4px 0; display: flex; gap: 6px; align-items: center; }
.wh-dos .wh-dos-more[open] > summary { margin-bottom: 8px; }
.wh-dos .wh-dos-trance { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin-top: 12px; }
.wh-dos .wh-dos-stage { position: relative; text-align: center; font-size: 0.7em; line-height: 1; padding: 14px 0 0; opacity: 0.55; }
.wh-dos .wh-dos-stage::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 8px; border-radius: 4px; background: color-mix(in srgb, var(--wh-text) 12%, transparent); }
.wh-dos .wh-dos-stage.wh-on::before { background: linear-gradient(90deg, rgba(var(--k), 0.55), rgba(var(--k), 0.95)); }
.wh-dos .wh-dos-stage.wh-now { opacity: 1; font-weight: 700; }
.wh-dos .wh-dos-stage.wh-deepest::after { content: "▾ deepest"; position: absolute; left: 0; right: 0; top: -12px; font-size: 0.85em; opacity: 0.7; font-weight: 400; }
.wh-dos .wh-dos-list { display: flex; flex-direction: column; gap: 4px; font-size: 0.9em; }
.wh-dos .wh-dos-list-title { font-size: 0.8em; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; opacity: 0.6; }
.wh-dos .wh-dos-item { display: flex; gap: 7px; align-items: baseline; }
.wh-dos .wh-dos-item > .wh-dos-tag, .wh-dos .wh-dos-item > .wh-dos-cue, .wh-dos .wh-dos-item > .wh-i { flex: none; }
.wh-dos .wh-dos-item > span:not(.wh-dos-tag):not(.wh-dos-cue) { min-width: 0; }
.wh-dos .wh-dos-tag { font-size: 0.78em; padding: 0 7px; border-radius: 6px; white-space: nowrap; background: rgba(var(--k), 0.18); border: 1px solid rgba(var(--k), 0.45); }
.wh-dos .wh-dos-cue { font-weight: 700; color: var(--wh-accent); }
.wh-dos .wh-dos-quote { padding: 8px 10px; border-left: 2px solid rgba(var(--k), 0.6); border-radius: 6px; background: color-mix(in srgb, var(--wh-text) 5%, transparent); font-size: 0.92em; }
@media (max-width: 600px) { .wh-dos .wh-dos-head { flex-direction: column; } .wh-dos .wh-dos-avatar { width: 46px; height: 46px; } }
.wh-dos .wh-dos-part { position: relative; min-width: 0; padding-right: 22px; border-radius: 8px; }
.wh-dos .wh-dos-part.wh-dos-grow { flex: 1; }
.wh-dos .wh-dos-tools { position: absolute; top: 0; right: 0; display: flex; gap: 2px; }
.wh-dos .wh-dos-tool { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 6px; font-size: 0.78em; cursor: pointer; opacity: 0; transition: opacity 0.15s, background 0.15s; }
.wh-dos .wh-dos-card:hover .wh-dos-tool, .wh-dos .wh-dos-part:focus-within .wh-dos-tool { opacity: 0.45; }
.wh-dos .wh-dos-part:hover .wh-dos-tool { opacity: 0.8; }
.wh-dos .wh-dos-tool:hover, .wh-dos .wh-dos-tool:focus-visible { opacity: 1 !important; background: color-mix(in srgb, var(--wh-text) 12%, transparent); outline: none; }
@media (hover: none) { .wh-dos .wh-dos-tool { opacity: 0.45; } }
.wh-dos .wh-dos-sheet-part .wh-dos-tools { top: 5px; right: 4px; }
.wh-dos .wh-dos-sheet-part { padding-right: 0; }
.wh-dos .wh-dos-sheet-part .wh-dos-sheet, .wh-dos .wh-dos-sheet-part .wh-dos-note { padding-right: 74px; }
.wh-dos .wh-dos-small { font-size: 0.8em; margin-top: 4px; }
.wh-dos .wh-dos-form { display: flex; flex-direction: column; gap: 8px; padding: 10px; border-radius: 10px; min-width: 0; background: color-mix(in srgb, var(--wh-text) 6%, transparent); border: 1px solid color-mix(in srgb, var(--wh-accent) 45%, transparent); }
.wh-dos .wh-dos-card-head:has(> .wh-dos-form) { flex-wrap: wrap; }
.wh-dos .wh-dos-card-head > .wh-dos-form { flex: 1 1 100%; }
.wh-dos .wh-dos-chips > .wh-dos-form { flex-basis: 100%; }
.wh-dos .wh-dos-form-title { font-weight: 700; font-size: 0.95em; }
.wh-dos .wh-dos-fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 120px), 1fr)); gap: 6px 8px; }
.wh-dos .wh-dos-full { grid-column: 1 / -1; }
.wh-dos .wh-dos-f { display: flex; flex-direction: column; min-width: 0; margin: 0; gap: 2px; }
.wh-dos .wh-dos-f small { font-size: 0.75em; opacity: 0.65; }
.wh-dos .wh-dos-f textarea { min-height: 2.6em; }
.wh-dos .wh-dos-form .checkbox_label { margin: 0; font-size: 0.9em; }
.wh-dos .wh-dos-form-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.wh-dos .wh-dos-form-actions.wh-dos-center { justify-content: center; }
.wh-dos .wh-dos-grow { flex: 1; }
.wh-dos .wh-dos-tbtn { white-space: nowrap; }
.wh-dos .wh-dos-primary { border-color: color-mix(in srgb, var(--wh-accent) 70%, transparent); background: color-mix(in srgb, var(--wh-accent) 22%, transparent); }
.wh-dos .wh-dos-danger { color: rgb(226, 95, 94); }
.wh-dos .wh-dos-head > .wh-dos-tbtn { flex: none; align-self: center; }
.wh-dos .wh-dos-batch { flex: none; align-self: center; font-size: 0.88em; opacity: 0.85; white-space: nowrap; display: flex; gap: 6px; align-items: center; }
.wh-dos .wh-dos-add { border: 1px dashed var(--wh-line); background: transparent; min-height: 84px; display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 8px; cursor: pointer; opacity: 0.6; transition: opacity 0.15s, border-color 0.15s; }
.wh-dos .wh-dos-add:hover, .wh-dos .wh-dos-add:focus-visible { opacity: 1; border-color: var(--wh-accent); outline: none; }
.wh-dos .wh-dos-chip-add { border-style: dashed; cursor: pointer; opacity: 0.65; background: transparent; }
.wh-dos .wh-dos-chip-add:hover, .wh-dos .wh-dos-tap:hover { opacity: 1; border-color: var(--wh-accent); }
.wh-dos .wh-dos-tap { cursor: pointer; }
.wh-dos.wh-dos-picture { align-items: center; text-align: center; }
.wh-dos .wh-dos-frame { --k: var(--wh-idle); position: relative; width: min(100%, 360px); aspect-ratio: 1; border-radius: 16px; overflow: hidden; display: grid; place-items: center; border: 2px solid rgba(var(--k), 0.6); background: radial-gradient(circle at 35% 30%, rgba(var(--k), 0.3), rgba(var(--k), 0.08)); }
.wh-dos .wh-dos-frame.wh-dos-k-you { --k: var(--wh-you); }
.wh-dos .wh-dos-frame.wh-dos-k-npc { --k: var(--wh-npc); }
.wh-dos .wh-dos-frame.wh-dos-k-back { --k: var(--wh-back); }
.wh-dos .wh-dos-frame > img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%; }
.wh-dos .wh-dos-frame > .wh-dos-initial { font-size: 5em; font-weight: 700; color: rgb(var(--k)); }
.wh-dos .wh-dos-frame-busy { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; background: rgba(0, 0, 0, 0.5); color: #fff; font-size: 1.1em; }
.wh-dos .wh-dos-look { max-width: 420px; font-size: 0.9em; line-height: 1.45; display: flex; gap: 6px; align-items: baseline; justify-content: center; flex-wrap: wrap; }
.wh-dos .wh-dos-look .wh-dos-tool { opacity: 0.6; position: static; }
`;

// src/frontend/icons.js
var P = {
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  "user-group": '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8"/><path d="M22 21a6 6 0 0 0-4-5.6"/>',
  "user-slash": '<circle cx="10" cy="8" r="4"/><path d="M2 21a8 8 0 0 1 13-6.2"/><path d="m17 17 5 5M22 17l-5 5"/>',
  "user-check": '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="m16 11 2 2 4-4"/>',
  ghost: '<path d="M9 10h.01M15 10h.01"/><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/>',
  wind: '<path d="M17.7 7.7A2.5 2.5 0 1 1 19.5 12H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2"/>',
  clone: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  "eye-slash": '<path d="M10.7 5.1A10.7 10.7 0 0 1 22 12a13 13 0 0 1-1.7 2.7M6.6 6.6A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.4-1.6M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20"/>',
  pen: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  xmark: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  "trash-can": '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  rotate: '<path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
  "rotate-left": '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  "wand-magic-sparkles": '<path d="m15 4-11 11a1.4 1.4 0 0 0 0 2l3 3a1.4 1.4 0 0 0 2 0L20 9a1.4 1.4 0 0 0 0-2l-3-3a1.4 1.4 0 0 0-2 0Z"/><path d="m12 7 5 5M5 3v4M3 5h4M19 15v4M17 17h4"/>',
  shapes: '<path d="M8.3 10a.7.7 0 0 1-.6-1.1l3.7-6a.7.7 0 0 1 1.2 0l3.7 6a.7.7 0 0 1-.6 1.1z"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>',
  "people-arrows": '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
  brain: '<path d="M12 5a3 3 0 1 0-6 .1 4 4 0 0 0-2.5 5.8 4 4 0 0 0 .6 6.6A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 6 .1 4 4 0 0 1 2.5 5.8 4 4 0 0 1-.6 6.6A4 4 0 1 1 12 18Z"/><path d="M12 5v13"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  microchip: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  toolbox: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  "clock-rotate-left": '<path d="M3 12a9 9 0 1 0 9-9 9.8 9.8 0 0 0-6.7 2.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  "circle-question": '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  "power-off": '<path d="M12 2v10M18.4 6.6a9 9 0 1 1-12.8 0"/>',
  "circle-dot": '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1.5"/>',
  "hand-sparkles": '<path d="M9.9 2.4 8.5 6.6 4.3 8l4.2 1.4 1.4 4.2 1.4-4.2L15.5 8l-4.2-1.4zM18 13l-.9 2.6-2.6.9 2.6.9.9 2.6.9-2.6 2.6-.9-2.6-.9z"/>',
  "masks-theater": '<path d="M2 12a5 5 0 0 0 5 5 8 8 0 0 1 5 2 8 8 0 0 1 5-2 5 5 0 0 0 5-5V7h-5a8 8 0 0 0-5 2 8 8 0 0 0-5-2H2Z"/><path d="M6 11c1.5 0 3 .5 3 2-2 0-3 0-3-2ZM18 11c-1.5 0-3 .5-3 2 2 0 3 0 3-2Z"/>',
  spinner: '<path d="M21 12a9 9 0 1 1-6.2-8.6"/>',
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  "up-right-and-down-left-from-center": '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  "down-left-and-up-right-to-center": '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  "address-card": '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 8h2M15 12h2M6 16a3.5 3.5 0 0 1 6 0"/>',
  "feather-pointed": '<path d="M20.2 12.2a6 6 0 0 0-8.5-8.5L5 10.5V19h8.5zM16 8 2 22M17.5 15H9"/>',
  feather: '<path d="M20.2 12.2a6 6 0 0 0-8.5-8.5L5 10.5V19h8.5zM16 8 2 22M17.5 15H9"/>',
  "location-dot": '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  "person-walking": '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  tags: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1"/>',
  "house-user": '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  "address-book": '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><circle cx="12" cy="9" r="2"/><path d="M9 14a3 3 0 0 1 6 0"/>',
  eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21M22 21H7M5 11l9 9"/>',
  "hand-fist": '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
  "arrow-right-long": '<path d="M5 12h14M12 5l7 7-7 7"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  "magnifying-glass": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  stethoscope: '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 12 0V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 12 0v-4"/><circle cx="20" cy="10" r="2"/>',
  "triangle-exclamation": '<path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>',
  "circle-info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  hurricane: '<path d="M12 12a2.5 2.5 0 1 0 2.5 2.5"/><path d="M12 12a6 6 0 1 1 6-6"/><path d="M12 12a9 9 0 1 0 9 9"/>'
};
function svg(name, cls = "") {
  const body = P[name] || P["circle-info"];
  return `<svg class="wh-i${cls ? ` ${cls}` : ""}" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
function iconFor(spec) {
  const words = String(spec || "").split(/\s+/).filter(Boolean);
  const name = (words.find((w) => w.startsWith("fa-") && w !== "fa-spin" && w !== "fa-solid") || "").replace(/^fa-/, "");
  const extra = words.filter((w) => !w.startsWith("fa-")).concat(words.includes("fa-spin") ? ["wh-spin"] : []);
  return svg(name || spec, extra.join(" "));
}
var ICON_SVG = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name] || ""}</svg>`;

// src/frontend/views.js
var import_jquery = __toESM(require_jquery(), 1);

// src/core/mind-core.js
var STAGES = ["awake", "light", "medium", "deep", "somnambulistic"];
var EMPTY_BOOK = Object.freeze({ hypnosis: [], control: [], perception: [] });
var TRAPPED = new RegExp([
  String.raw`\b(?:trapped|caged|locked|imprisoned|buried)\s+(?:deep\s+)?(?:inside|within|in)\s+(?:her|his|their|your|my)\s+(?:own\s+)?(?:mind|head|body|skull)`,
  String.raw`\b(?:somewhere|deep)\s+(?:deep\s+)?(?:inside|within|down)(?:\s+(?:her|him|them|you))?,?\s+(?:a|some)\s+(?:small|tiny|distant|faint|buried)?\s*(?:part|voice|piece|corner)`,
  String.raw`\ba\s+(?:small|tiny|distant|faint|buried|last)\s+(?:part|voice|piece|corner|spark)\s+of\s+(?:her|him|them|you|his|their|your)(?:\s+(?:mind|self))?\s+(?:screamed|screams|fought|fights|struggled|struggles|protested|protests|resisted|resists|begged|begs|cried|cries|knew|knows|railed|rails|clawed|claws)`,
  String.raw`\b(?:fought|fights|struggled|struggles|strained|strains|pushed|pushes)\s+against\s+the\s+(?:control|compulsion|command|commands|order|orders|pull|grip|hold)`,
  String.raw`\bagainst\s+(?:her|his|their|your|my)\s+(?:own\s+)?will\b`,
  String.raw`\b(?:her|his|their|your|my)\s+body\s+(?:moved|moves|acted|acts)\s+on\s+its\s+own`,
  String.raw`\b(?:screaming|screamed|screams)\s+(?:inside|silently|inwardly)`
].join("|"), "i");

// src/core/persona-core.js
var PERSONA_FIELDS = ["Look", "Voice & habits", "Life"];

// src/frontend/views.js
var el = (tag, cls = "", text) => {
  const e = import_jquery.default(document.createElement(tag));
  if (cls)
    e.addClass(cls);
  if (text != null)
    e.text(text);
  return e;
};
var fa = (name) => import_jquery.default(iconFor(name));
var txt = (s) => document.createTextNode(s);
var press = (node, fn) => node.attr({ role: "button", tabindex: 0 }).on("click keydown", (e) => {
  if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ")
    return;
  e.preventDefault();
  e.stopPropagation();
  fn();
});
var textButton = (icon, label, fn, cls = "") => press(el("div", `menu_button wh-dos-tbtn ${cls}`).append(fa(icon), txt(` ${label}`)), fn);
var tool = (icon, title, fn) => press(el("span", "wh-dos-tool").attr("title", title).append(fa(icon)), fn);
function avatar(name, kind, face = {}) {
  const a = el("div", `wh-dos-avatar wh-dos-k-${kind}`);
  if (face.image)
    a.append(import_jquery.default('<img alt="" loading="lazy">').attr("src", face.image));
  else
    a.append(el("span", "wh-dos-initial", String(name || "?").trim().charAt(0).toUpperCase() || "?"));
  if (face.busy)
    a.addClass("wh-dos-drawing").append(el("span", "wh-dos-spin").append(fa("fa-spinner fa-spin")));
  if (face.open) {
    press(a.addClass("wh-dos-pic").attr("title", face.image ? `${name}'s picture` : `Draw ${name}`), face.open);
    a.append(el("span", "wh-dos-badge").append(fa(face.image ? "fa-expand" : "fa-wand-magic-sparkles")));
  }
  return a;
}
var pill = (cls, icon, label) => el("span", `wh-dos-pill ${cls}`).append(icon ? fa(icon) : "", txt(`${icon ? " " : ""}${label}`));
function header(title, sub, icon, extra = "") {
  return el("div", "wh-dos-head").append(el("div", "wh-dos-head-text").append(el("h3", "wh-dos-title").append(fa(icon), txt(` ${title}`)), el("small", "wh-dos-sub", sub)), extra);
}
var drawMissing = (d, a) => d.batch ? el("span", "wh-dos-batch").append(fa("fa-spinner fa-spin"), txt(` ${d.batch}`)) : d.missing?.length ? textButton("fa-wand-magic-sparkles", `Draw missing pictures (${d.missing.length})`, () => a.drawMissing(d.missing)) : "";
var section = (title, icon, count) => el("div", "wh-dos-section").append(fa(icon), txt(` ${title}`), count ? el("span", "wh-dos-count", String(count)) : "");
var input = (k, label, ph, value, cls = "") => el("label", `wh-dos-f ${cls}`).append(el("small", "", label), import_jquery.default('<input type="text" class="text_pole">').attr({ "data-k": k, placeholder: ph }).val(value ?? ""));
var area = (k, label, ph, value, rows = 2) => el("label", "wh-dos-f wh-dos-full").append(el("small", "", label), import_jquery.default('<textarea class="text_pole"></textarea>').attr({ "data-k": k, placeholder: ph, rows }).val(value ?? ""));
var choose = (k, label, options, value) => el("label", "wh-dos-f").append(el("small", "", label), import_jquery.default('<select class="text_pole"></select>').attr("data-k", k).append(options.map((o) => import_jquery.default("<option></option>").val(o).text(o || "—"))).val(value ?? ""));
var tick = (k, label, checked) => el("label", "checkbox_label wh-dos-full").append(import_jquery.default('<input type="checkbox">').attr("data-k", k).prop("checked", !!checked), el("span", "", label));
var grid = (...fields) => el("div", "wh-dos-fields").append(fields);
function readForm(form) {
  const o = {};
  form.find("[data-k]").each((_, x) => {
    o[import_jquery.default(x).attr("data-k")] = x.type === "checkbox" ? x.checked ? "yes" : "no" : String(import_jquery.default(x).val() ?? "");
  });
  return o;
}
function openForm(node, { fields, save, remove, removeLabel = "Remove", refresh, wide = false }) {
  const form = el("div", `wh-dos-form wh-dos-editing${wide ? " wh-dos-form-wide" : ""}`).append(fields);
  const done = () => {
    form.removeClass("wh-dos-editing");
    refresh();
  };
  let busy = false;
  const ok = async () => {
    if (busy)
      return;
    busy = true;
    const r = await save(readForm(form));
    busy = false;
    if (r !== false)
      done();
  };
  form.append(el("div", "wh-dos-form-actions").append(remove ? textButton("fa-trash-can", removeLabel, async () => {
    if (await remove() !== false)
      done();
  }, "wh-dos-danger") : "", el("span", "wh-dos-grow"), textButton("fa-xmark", "Cancel", done), textButton("fa-check", "Save", ok, "wh-dos-primary")));
  form.on("keydown", "input, textarea, select", (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox") {
      e.preventDefault();
      ok();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      done();
    }
  });
  node.replaceWith(form);
  form.find("input, textarea, select").first().trigger("focus");
}
function part(content, form, refresh, { cls = "", tools = [], label = "this" } = {}) {
  const box = el("div", `wh-dos-part ${cls}`).append(content);
  if (form || tools.length) {
    const pen = form ? tool("fa-pen", `Change ${label}`, () => openForm(box, { ...form, refresh })) : "";
    box.append(el("span", "wh-dos-tools").append(tools, pen));
  }
  return box;
}
function sheetBlock(sheet) {
  const box = el("div", "wh-dos-sheet");
  for (const f of PERSONA_FIELDS)
    if (sheet?.[f])
      box.append(el("div", "wh-dos-sheet-row").append(el("span", "wh-dos-label", f), el("span", "wh-dos-value", sheet[f])));
  return box;
}
var sheetFields = (sheet) => grid(area("Look", "Look", "what people notice first about them", sheet?.Look), area("Voice & habits", "Voice & habits", "how they talk, and one small habit", sheet?.["Voice & habits"]), area("Life", "Life", "what they do and who they live with", sheet?.Life));
var WHO_FIELDS = (r) => [
  input("body", "Body", "whose body", r.body),
  input("pronouns", "Pronouns", "she/her", r.pronouns),
  input("driver", "Mind inside", "who is in it (blank if nobody)", r.driver),
  input("driver_pronouns", "Their pronouns", "he/him", r.driver_pronouns),
  input("how", "How", "possession, swap, skinsuit…", r.how),
  input("host", "Owner's mind", "gone, asleep, watching…", r.host),
  tick("user_knows", "You know about this", r.user_knows !== "no")
];
var WHERE_FIELDS = (r) => [
  input("notes", "Where, and anything to remember", "in the campus library, gray hoodie", r.notes, "wh-dos-full"),
  input("doing", "Busy with", "what it is doing right now", r.doing, "wh-dos-full")
];
function ledgerView(d, a) {
  const root = el("div", "wh-dos");
  root.append(header("Body Ledger", "Who is in which body right now, and who they are in their own lives. Tap ✏️ by anything to change it.", "fa-people-arrows", drawMissing(d, a)));
  const sheetPart = (name, h, { canWrite = true } = {}) => {
    if (h.busy)
      return el("div", "wh-dos-note wh-dos-busy").append(fa("fa-spinner fa-spin"), txt(` ${h.busy}`));
    const content = h.sheet ? sheetBlock(h.sheet) : el("div", "wh-dos-note", h.removed ? "Sheet deleted: no new one while this ride lasts." : "Who they are in their own life gets written after the next reply.");
    const tools = [
      ...h.sheet ? [tool("fa-address-card", `Make a persona of ${name}`, () => a.makePersona(name))] : [],
      ...canWrite ? [tool(h.sheet ? "fa-rotate" : "fa-feather-pointed", h.sheet ? "Write the sheet again" : "Write the sheet now", () => a.writeSheet(name))] : []
    ];
    return part(content, {
      fields: sheetFields(h.sheet),
      save: (v) => a.saveSheet(name, v),
      ...h.sheet ? { remove: () => a.deleteSheet(name), removeLabel: "Delete the sheet" } : {}
    }, a.refresh, { cls: "wh-dos-sheet-part", tools, label: `who ${name} is` });
  };
  const bodyCard = (b) => {
    const card = el("article", `wh-dos-card wh-dos-k-${b.kind}`);
    const save = (row) => a.saveBody(b.i, b.row, { row });
    const titles = el("div", "wh-dos-titles").append(el("div", "wh-dos-name").append(el("span", "", b.title), b.row.pronouns && b.row.body ? el("small", "wh-dos-pron", b.row.pronouns) : ""), el("div", "wh-dos-pills").append(pill(`wh-dos-k-${b.kind}`, b.icon, b.inside).attr("title", b.row.driver && b.row.driver_pronouns ? `${b.row.driver} (${b.row.driver_pronouns})` : null), b.row.how ? pill("wh-dos-soft", "", b.row.how) : "", b.row.host ? pill("wh-dos-soft", "", `own mind: ${b.row.host}`) : "", b.hidden ? pill("wh-dos-hidden", "fa-eye-slash", "hidden from you") : ""));
    card.append(el("div", "wh-dos-card-head").append(avatar(b.title, b.kind, b.face), part(titles, { fields: grid(...WHO_FIELDS(b.row)), save, remove: () => a.removeBody(b.i, b.row), removeLabel: "Take out of the Ledger", wide: true }, a.refresh, { cls: "wh-dos-grow", label: "who is in it" })));
    const facts = el("div", "wh-dos-facts");
    if (b.row.notes)
      facts.append(el("div", "wh-dos-fact").append(fa("fa-location-dot"), el("span", "", b.row.notes)));
    if (b.row.doing)
      facts.append(el("div", "wh-dos-fact").append(fa("fa-person-walking"), el("span", "", b.row.doing)));
    if (!facts.children().length)
      facts.append(el("div", "wh-dos-fact wh-dos-faint").append(fa("fa-location-dot"), el("span", "", "Where they are, and what they’re doing")));
    card.append(part(facts, { fields: grid(...WHERE_FIELDS(b.row)), save }, a.refresh, { label: "where they are" }));
    if (b.sheetable)
      card.append(sheetPart(b.row.body, b));
    return card;
  };
  root.append(section("Bodies", "fa-user-group", d.bodies.length));
  if (!d.bodies.length)
    root.append(el("div", "wh-dos-empty").append(fa("fa-user-check"), el("span", "", d.empty)));
  const bodies = el("div", "wh-dos-grid").append(d.bodies.map(bodyCard));
  const add = press(el("article", "wh-dos-card wh-dos-add").append(fa("fa-plus"), el("span", "", "Add a body")), () => {
    const card = el("article", "wh-dos-card wh-dos-k-idle").append(el("div", "wh-dos-form-title", "New body"), el("div"));
    add.before(card).hide();
    openForm(card.children().last(), {
      fields: [grid(...WHO_FIELDS({}), ...WHERE_FIELDS({})), el("div", "wh-dos-form-title", "Who they are in their own life (optional)"), sheetFields({})],
      save: (v) => {
        const row = {}, sheet = {};
        for (const [k, x] of Object.entries(v))
          (PERSONA_FIELDS.includes(k) ? sheet : row)[k] = x;
        return a.saveBody(-1, null, { row, sheet });
      },
      refresh: a.refresh
    });
  });
  root.append(bodies.append(add));
  const chipForm = (chip, fields, save, remove) => openForm(chip, { fields: grid(...fields), save, remove, refresh: a.refresh, wide: true });
  const chips = el("div", "wh-dos-chips");
  const powerFields = (p) => [input("who", "Who", "who has it", p?.who), input("power", "Power", "e.g. body swap by touch", p?.power)];
  const aliasFields = (x) => [input("name", "Name", "main name", x?.name), input("aka", "Also called", "other names, comma-separated", (x?.aka || []).join(", "))];
  d.powers.forEach((p, i) => {
    const chip = press(el("span", "wh-dos-chip wh-dos-tap").attr("title", "Tap to change").append(fa("fa-bolt"), el("b", "", p.who), txt(` ${p.power}`)), () => chipForm(chip, powerFields(p), (v) => a.savePower(i, v), () => a.savePower(i, null)));
    chips.append(chip);
  });
  d.aliases.forEach((x, i) => {
    const chip = press(el("span", "wh-dos-chip wh-dos-tap").attr("title", "Tap to change").append(fa("fa-tags"), el("b", "", x.name), txt(` also ${x.aka.join(", ")}`)), () => chipForm(chip, aliasFields(x), (v) => a.saveAlias(i, v), () => a.saveAlias(i, null)));
    chips.append(chip);
  });
  const addPower = press(el("span", "wh-dos-chip wh-dos-chip-add").append(fa("fa-plus"), txt(" Power")).attr("title", "Who can do what: kept in mind even when nobody is using it"), () => chipForm(addPower, powerFields(), (v) => a.savePower(-1, v)));
  const addAlias = press(el("span", "wh-dos-chip wh-dos-chip-add").append(fa("fa-plus"), txt(" Name")).attr("title", "One person, several names: a code name, a handle, a host number"), () => chipForm(addAlias, aliasFields(), (v) => a.saveAlias(-1, v)));
  root.append(section("Powers and names", "fa-bolt"), chips.append(addPower, addAlias));
  const hostCard = (h, kind, pills) => el("article", `wh-dos-card wh-dos-k-${kind}`).append(el("div", "wh-dos-card-head").append(avatar(h.body, kind, h.face), el("div", "wh-dos-titles").append(el("div", "wh-dos-name").append(el("span", "", h.body)), pills ? el("div", "wh-dos-pills").append(pills) : "")), sheetPart(h.body, h));
  if (d.back.length) {
    root.append(section("Back in their own bodies", "fa-house-user", d.back.length), el("div", "wh-dos-grid").append(d.back.map((h) => hostCard(h, "back", pill("wh-dos-k-back", "fa-house-user", "themselves again, still here")))));
  }
  if (d.history.length) {
    root.append(section("History", "fa-clock-rotate-left", d.history.length));
    root.append(el("ol", "wh-dos-timeline").append(d.history.map((h) => el("li", h.ongoing ? "wh-dos-now" : "").append(el("div", "wh-dos-tl-title").append(el("span", "", h.title), h.hidden ? fa("fa-eye-slash") : ""), ...h.lines.map(([label, value]) => el("div", "wh-dos-tl-line").append(el("span", "wh-dos-label", label), el("span", "", value)))))));
  }
  if (d.past.length) {
    const more = el("details", "wh-dos-more");
    more.append(el("summary", "").append(fa("fa-address-book"), txt(` Other hosts from this chat (${d.past.length})`)));
    root.append(more.append(el("div", "wh-dos-grid").append(d.past.map((h) => hostCard(h, "idle")))));
  }
  return root;
}
function tranceMeter(now, deepest) {
  const meter = el("div", "wh-dos-trance").attr("aria-label", `trance: ${now}`);
  const ni = Math.max(0, STAGES.indexOf(now)), di = STAGES.indexOf(deepest);
  STAGES.forEach((s, i) => {
    const step = el("div", "wh-dos-stage").attr("title", s);
    if (i > 0 && i <= ni)
      step.addClass("wh-on");
    if (i === ni)
      step.addClass("wh-now");
    if (i > 0 && i === di)
      step.addClass("wh-deepest");
    meter.append(step.append(el("span", "", s === "somnambulistic" ? "somnamb." : s)));
  });
  return meter;
}
var lines = (k, label, ph, value) => area(k, label, ph, value, 3);
var asLines = {
  suggestions: (h) => (h.suggestions || []).map((x) => `${x.text}${x.stage ? ` | ${x.stage}` : ""}${x.times > 1 ? ` | ${x.times}×` : ""}`).join(`
`),
  triggers: (h) => (h.triggers || []).map((x) => `${x.cue} → ${x.effect}`).join(`
`),
  set: (w) => (w.set || []).map((x) => `${x.kind}: ${x.text}`).join(`
`)
};
var MIND_PARTS = {
  hypnosis: {
    who: (h) => [
      input("who", "Who", "who is hypnotized", h.who),
      input("by", "By", "who hypnotizes them", h.by),
      choose("susceptibility", "Susceptibility", ["", "low", "average", "high"], h.susceptibility),
      tick("amnesia", "Told to forget the sessions", h.amnesia === "yes"),
      tick("user_knows", "You know about this", h.user_knows !== "no")
    ],
    trance: (h) => [
      choose("now", "Right now", STAGES, h.now || "awake"),
      choose("deepest", "Deepest so far", ["", ...STAGES.slice(1)], h.deepest),
      input("times", "Times under", "0", h.times ? String(h.times) : "")
    ],
    suggestions: (h) => [lines("suggestions", "Suggestions, one per line: what it is | stage", "finds Ash's voice calming | deep", asLines.suggestions(h))],
    triggers: (h) => [lines("triggers", "Triggers, one per line: cue → effect", "bloom → drops into a trance", asLines.triggers(h))]
  },
  control: {
    who: (w) => [
      input("who", "Who", "one name, or several separated by commas", (w.who || []).join(", ")),
      input("by", "Controller", "who holds the control", w.by),
      tick("resists", "Aware of it and pushing against it", w.resists === "yes"),
      tick("user_knows", "You know about this", w.user_knows !== "no")
    ],
    set: (w) => [lines("set", "What was set, one per line: wants / feels / believes / loyal to / command: …", "wants: to please Ash above everything", asLines.set(w))],
    own: (w) => [input("own", "Still their own", 'what the control left alone, or "nothing: a blank drone"', w.own, "wh-dos-full")]
  },
  perception: {
    who: (e) => [
      choose("kind", "Kind", ["unseen", "normal", "false"], e.kind || "unseen"),
      input("target", "Can't perceive (unseen only)", "who or what", e.target),
      input("who", "Who has it", "names, separated by commas", (e.who || []).join(", ")),
      input("except", "Except (with everyone)", "names", (e.except || []).join(", ")),
      tick("everyone", "Everyone has it", e.everyone),
      input("by", "Made by", "who edited them", e.by),
      tick("user_knows", "You know about this", e.user_knows !== "no")
    ],
    what: (e) => [input("what", "The edit", "one plain sentence", e.what, "wh-dos-full")]
  }
};
var MIND_SECTIONS = [
  ["hypnosis", "Hypnosis", "fa-circle-dot", "Add someone hypnotized"],
  ["control", "Mind control", "fa-hand-sparkles", "Add a controlled will"],
  ["perception", "Altered perception", "fa-eye-slash", "Add a perception edit"]
];
function mindView(d, a) {
  const root = el("div", "wh-dos");
  root.append(header("Mind Book", "What hypnosis, mind control and altered perception have put into people. Tap ✏️ by anything to change it.", "fa-brain", drawMissing(d, a)));
  if (!d.kinds.length) {
    root.append(el("div", "wh-dos-empty").append(fa("fa-feather"), el("span", "", d.empty)));
    return root;
  }
  const entryPart = (kind, x, name, content, opts = {}) => part(content, {
    fields: grid(...MIND_PARTS[kind][name](x.raw)),
    save: (v) => a.save(kind, x.i, x.raw, v),
    ...name === "who" ? { remove: () => a.remove(kind, x.i, x.raw), removeLabel: "Take out of the Mind Book", wide: true } : {}
  }, a.refresh, opts);
  const list = (title, items, empty) => el("div", "wh-dos-list").append(el("div", "wh-dos-list-title", title), items.length ? items : el("div", "wh-dos-item wh-dos-faint", empty));
  const head = (name, kind, face, pills) => el("div", "wh-dos-titles").append(el("div", "wh-dos-name").append(el("span", "", name)), el("div", "wh-dos-pills").append(pills));
  const cards = {
    hypnosis: (h) => el("article", `wh-dos-card wh-dos-k-${h.kind}`).append(el("div", "wh-dos-card-head").append(avatar(h.who, h.kind, h.face), entryPart("hypnosis", h, "who", head(h.who, h.kind, h.face, [
      h.by ? pill(`wh-dos-k-${h.kind}`, "fa-circle-dot", `by ${h.byLabel}`) : "",
      h.susceptibility ? pill("wh-dos-soft", "", `${h.susceptibility} susceptibility`) : "",
      h.amnesia ? pill("wh-dos-soft", "fa-eraser", "told to forget") : "",
      h.hidden ? pill("wh-dos-hidden", "fa-eye-slash", "hidden from you") : ""
    ]), { cls: "wh-dos-grow", label: "who it is" })), entryPart("hypnosis", h, "trance", el("div", "").append(tranceMeter(h.now, h.deepest), h.times ? el("div", "wh-dos-faint wh-dos-small", `under ${h.times}×`) : ""), { label: "the trance" }), entryPart("hypnosis", h, "suggestions", list("Suggestions", h.suggestions.map((s) => el("div", "wh-dos-item").append(s.stage ? el("span", "wh-dos-tag", s.stage) : "", el("span", "", s.text), s.reinforced ? el("small", "wh-dos-faint", " reinforced") : "")), "none yet"), { label: "the suggestions" }), entryPart("hypnosis", h, "triggers", list("Triggers", h.triggers.map((t) => el("div", "wh-dos-item").append(el("span", "wh-dos-cue", `“${t.cue}”`), fa("fa-arrow-right-long wh-dos-faint"), el("span", "", t.effect || ""))), "none yet"), { label: "the triggers" })),
    control: (w) => el("article", `wh-dos-card wh-dos-k-${w.kind}`).append(el("div", "wh-dos-card-head").append(avatar(w.who[0], w.kind, w.face), entryPart("control", w, "who", head(w.who.join(", "), w.kind, w.face, [
      w.by ? pill(`wh-dos-k-${w.kind}`, "fa-hand-sparkles", w.byLabel === "you" ? "your control" : `${w.byLabel}'s control`) : "",
      w.resists ? pill("wh-dos-warn", "fa-hand-fist", "resisting") : "",
      w.hidden ? pill("wh-dos-hidden", "fa-eye-slash", "hidden from you") : ""
    ]), { cls: "wh-dos-grow", label: "who it is" })), entryPart("control", w, "set", list(w.by ? `Set by ${w.byLabel}` : "Set", w.set.map((x) => el("div", "wh-dos-item").append(el("span", "wh-dos-tag", x.kind), el("span", "", x.text))), "nothing yet"), { label: "what was set" }), entryPart("control", w, "own", list("Still their own", w.own ? [el("div", "wh-dos-item").append(el("span", "", w.own))] : [], "not said"), { label: "what is still theirs" })),
    perception: (e) => el("article", `wh-dos-card wh-dos-k-${e.kind}`).append(el("div", "wh-dos-card-head").append(el("div", `wh-dos-avatar wh-dos-k-${e.kind}`).append(fa(e.icon)), entryPart("perception", e, "who", head(e.title, e.kind, null, [
      e.by ? pill(`wh-dos-k-${e.kind}`, "", `by ${e.byLabel}`) : "",
      e.hidden ? pill("wh-dos-hidden", "fa-eye-slash", "hidden from you") : ""
    ]), { cls: "wh-dos-grow", label: "who has it" })), entryPart("perception", e, "what", el("div", "wh-dos-quote", e.what), { label: "the edit" }))
  };
  for (const [kind, title, icon, addLabel] of MIND_SECTIONS) {
    if (!d.kinds.includes(kind))
      continue;
    root.append(section(title, icon, d[kind].length));
    const cardsGrid = el("div", "wh-dos-grid").append(d[kind].map(cards[kind]));
    const add = press(el("article", "wh-dos-card wh-dos-add").append(fa("fa-plus"), el("span", "", addLabel)), () => {
      const card = el("article", "wh-dos-card wh-dos-k-idle").append(el("div", "wh-dos-form-title", addLabel), el("div"));
      add.before(card).hide();
      openForm(card.children().last(), {
        fields: grid(...Object.values(MIND_PARTS[kind]).flatMap((f) => f({}))),
        save: (v) => a.save(kind, -1, null, v),
        refresh: a.refresh
      });
    });
    root.append(cardsGrid.append(add));
  }
  return root;
}
function pictureView(p, a) {
  const root = el("div", "wh-dos wh-dos-picture");
  const frame = el("div", `wh-dos-frame wh-dos-k-${p.kind || "idle"}`);
  if (p.image)
    frame.append(import_jquery.default('<img alt="">').attr("src", p.image));
  else
    frame.append(el("span", "wh-dos-initial", String(p.name || "?").charAt(0).toUpperCase()));
  if (p.busy)
    frame.append(el("div", "wh-dos-frame-busy").append(fa("fa-spinner fa-spin"), el("span", "", p.busy)));
  root.append(el("h3", "wh-dos-title", p.name), frame);
  const look = el("div", "wh-dos-look");
  if (p.look)
    look.append(el("span", "wh-dos-label", p.lookFromSheet ? "Look (from their sheet)" : "Look"), el("span", "", p.look));
  else
    look.append(el("span", "wh-dos-faint", "No look yet: drawing writes one from the chat first, or write your own."));
  if (!p.lookFromSheet && !p.busy)
    look.append(tool("fa-pen", p.look ? "Change the look" : "Write the look", a.editLook));
  root.append(look);
  if (!p.busy) {
    root.append(el("div", "wh-dos-form-actions wh-dos-center").append(textButton("fa-wand-magic-sparkles", p.image ? "Draw again" : "Draw", a.draw, "wh-dos-primary"), textButton("fa-upload", p.image ? "Use my own instead" : "Use my own", a.upload), p.image ? textButton("fa-xmark", "Remove", a.remove, "wh-dos-danger") : ""));
  }
  return root;
}

// src/core/codex-core.js
var MODE_GROUPS = [
  ["Occupancy", ["Possession", "Multipossession", "Propagation", "Copy Fidelity", "Puppetry", "Skinsuit", "Hive Mind", "Body Swap", "Reverse Vore"]],
  ["Overwrite", ["Hypnosis", "Mind Control", "Altered Perception", "Blank Slate", "Dronification", "Pet Play"]],
  ["Reduction", ["Dollification", "Limp Play"]],
  ["Other", ["Soul Play", "Timestop", "Segmentation", "Transformation"]]
];
var PARENT = { Multipossession: "Possession", "Copy Fidelity": "Propagation" };
var MODIFIERS = new Set(["Multipossession", "Copy Fidelity", "Reverse Vore"]);
var OCCUPANCY_BASE = ["Possession", "Propagation", "Puppetry", "Skinsuit", "Hive Mind", "Body Swap"];
var ALL_MODES = MODE_GROUPS.flatMap(([, modes]) => modes);
var CORE_PARTS = {
  "\uD83D\uDC41 Metaphysics Core · bodies": MODE_GROUPS.find(([g]) => g === "Occupancy")[1],
  "\uD83D\uDC41 Metaphysics Core · several bodies": ["Multipossession", "Hive Mind", "Puppetry"]
};
var MODE_BLURBS = {
  Possession: "a mind moves into a living host and drives it",
  Multipossession: "one mind drives several hosts at once",
  Propagation: "a host's mind is overwritten by a copy of someone else's",
  "Copy Fidelity": "copies of the player character appear in the story",
  Puppetry: "an empty body driven from outside by a controller in their own skin",
  Skinsuit: "a host's hollow skin is worn from within like a garment",
  "Hive Mind": "minds absorbed into a single network that is the original mind",
  "Body Swap": "two people trade bodies, each mind awake and living the other's life until it's undone",
  "Reverse Vore": "entry by being swallowed, then control seized from inside",
  Hypnosis: "realistic trances that deepen in stages over sessions, with suggestions sincerely rationalized as the subject's own",
  "Mind Control": "the mind itself taken over: wants, feelings and beliefs set by the controller and felt as the subject's own",
  "Altered Perception": "premises edited so the altered normal is defended as always true",
  "Blank Slate": "a mind wiped to a genuine void",
  Dronification: "personality stripped and replaced with function and designations",
  "Pet Play": "the mind becomes an animal's while the body stays human",
  Dollification: "a blank, poseable doll with nobody home",
  "Limp Play": "the body goes completely slack, dead weight",
  "Soul Play": "souls as objects that can be moved, split, merged or stored",
  Timestop: "time frozen for everyone except whoever stopped it",
  Segmentation: "body parts removed and exchanged freely",
  Transformation: "a body physically changes form (sex, build, species) while the mind stays the same person"
};
function expandModes(picked) {
  const set = new Set(picked.filter((m) => ALL_MODES.includes(m)));
  for (const m of [...set])
    if (PARENT[m])
      set.add(PARENT[m]);
  if (set.has("Reverse Vore") && !OCCUPANCY_BASE.some((m) => set.has(m)))
    set.add("Possession");
  return set;
}
var MOMENTS = ["absorbed", "worn", "shed", "trance", "control", "timestop", "resume", "swap", "transform"];
var DISPLAY_SCRIPTS = [
  { id: "wh-possession-box", scriptName: "WH - Possession", findRegex: "/%%possession%%[ \\t]*\\n?([\\s\\S]*?)\\n?[ \\t]*%%\\/possession%%/gi", replaceString: `<div class="wh-possess" markdown="1">
$1
</div>` },
  { id: "wh-release-box", scriptName: "WH - Release", findRegex: "/%%release%%[ \\t]*\\n?([\\s\\S]*?)\\n?[ \\t]*%%\\/release%%/gi", replaceString: `<div class="wh-release" markdown="1">
$1
</div>` },
  { id: "wh-moments", scriptName: "WH - Moments", findRegex: `/%%(${MOMENTS.join("|")})%%[ \\t]*\\n?([\\s\\S]*?)\\n?[ \\t]*%%\\/\\1%%/gi`, replaceString: `<div class="wh-moment wh-m-$1" markdown="1">
$2
</div>` },
  { id: "wh-stray-markers", scriptName: "WH - Stray markers", findRegex: `/^[ \\t]*%%\\/?(?:possession|release|${MOMENTS.join("|")})%%[ \\t]*\\n?/gim`, replaceString: "" },
  { id: "wh-body-lines", scriptName: "WH - Body lines", findRegex: "/^[ \\t]*\\[(?!ooc\\b)([^\\[\\]\\n:]{1,40})\\][ \\t]*(\\S.*)$/gim", replaceString: `
<div class="wh-lane" markdown="1">
<span class="wh-lane-name">$1</span> $2
</div>
`, placement: [1] }
].map((s) => ({ trimStrings: [], placement: [1, 2], disabled: false, markdownOnly: true, promptOnly: false, runOnEdit: true, substituteRegex: 0, minDepth: null, maxDepth: null, ...s }));

// src/frontend/index.js
var ctx = null;
var state = null;
var chatId = null;
var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var pending = new Map;
var seq = 0;
var LONG = new Set(["draw", "drawMissing", "review", "writeSheet", "suggest"]);
function call(op, args = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => {
      if (pending.delete(id))
        reject(new Error("no answer from the Worldhopper backend"));
    }, LONG.has(op) ? 600000 : 60000);
    pending.set(id, { resolve, reject, timer });
    ctx.sendToBackend({ type: "rpc", id, op, args: { chatId, ...args } });
  });
}
function notice(text, { kind = "info", action = null, timeout = 6000 } = {}) {
  const box = import_jquery2.default('<div class="wh-ui wh-toast"></div>').addClass(`wh-toast-${kind}`).append(import_jquery2.default("<span></span>").text(text));
  if (action)
    box.append(import_jquery2.default('<button type="button" class="menu_button"></button>').text(action.label).on("click", () => {
      action.run();
      box.remove();
    }));
  box.append(import_jquery2.default('<button type="button" class="wh-toast-x" title="Close"></button>').html(svg("xmark")).on("click", () => box.remove()));
  let host = import_jquery2.default("#wh_toasts");
  if (!host.length)
    host = import_jquery2.default('<div id="wh_toasts"></div>').appendTo(document.body);
  host.append(box);
  if (timeout)
    setTimeout(() => box.fadeOut(200, () => box.remove()), timeout);
}
var TOAST_CSS = `
#wh_toasts { position: fixed; z-index: 100000; top: 14px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 6px; width: min(92vw, 460px); pointer-events: none; }
#wh_toasts .wh-toast { pointer-events: auto; display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 12px; border: 1px solid var(--wh-line); background: var(--wh-panel); box-shadow: 0 8px 30px rgba(0,0,0,.35); font-size: .92em; }
#wh_toasts .wh-toast > span { flex: 1; }
#wh_toasts .wh-toast-warn { border-color: color-mix(in srgb, var(--lumiverse-warning, #e0a030) 60%, transparent); }
#wh_toasts .wh-toast-x { border: none; background: none; color: inherit; opacity: .6; cursor: pointer; display: inline-flex; }
`;
async function confirmIt(title, message, confirmLabel = "Remove") {
  try {
    return (await ctx.ui.showConfirm({ title, message, variant: "danger", confirmLabel, cancelLabel: "Cancel" }))?.confirmed;
  } catch {
    return window.confirm(message || title);
  }
}
function modal(title, { width = 920 } = {}) {
  const h = ctx.ui.showModal({ title, width, maxHeight: Math.round(window.innerHeight * 0.88) });
  const root = import_jquery2.default('<div class="wh-ui"></div>').appendTo(h.root);
  return { root, close: () => h.dismiss(), onClose: (fn) => h.onDismiss(fn) };
}
function ask(title, { value = "", rows = 6, ok = "Save", note = "" } = {}) {
  return new Promise((resolve) => {
    const m = modal(title, { width: 560 });
    let done = false;
    const finish = (v) => {
      if (done)
        return;
      done = true;
      resolve(v);
      m.close();
    };
    const area = import_jquery2.default('<textarea class="text_pole"></textarea>').attr("rows", rows).val(value);
    m.root.append(import_jquery2.default('<div class="wh-ask"></div>').append(note ? import_jquery2.default('<small class="wh-muted"></small>').text(note) : "", area, import_jquery2.default('<div class="wh-ask-actions"></div>').append(import_jquery2.default('<button type="button" class="menu_button">Cancel</button>').on("click", () => finish(null)), import_jquery2.default('<button type="button" class="menu_button wh-dos-primary"></button>').text(ok).on("click", () => finish(String(area.val()))))));
    m.onClose(() => {
      if (!done) {
        done = true;
        resolve(null);
      }
    });
    setTimeout(() => area.trigger("focus"), 50);
  });
}
var tab = null;
var panelWaiting = false;
var pickerOpen = null;
var helpOpen = new Set;
var settingsOpen = false;
var openRows = new Set;
var shownBlurb = null;
var connections = null;
var modelLists = new Map;
var groupOf = (m) => (MODE_GROUPS.find(([, list]) => list.includes(m))?.[0] || "other").toLowerCase();
var helpToggle = (key) => import_jquery2.default(`<span class="wh-help-toggle" role="button" tabindex="0" title="How it works"></span>`).attr("data-help", key).html(svg("circle-question")).toggleClass("wh-on", helpOpen.has(key));
var help = (key, html) => import_jquery2.default('<div class="wh-help"></div>').attr("data-help", key).toggleClass("wh-open", helpOpen.has(key)).html(html);
var iconBtn = (icon, title, fn, on = false) => import_jquery2.default('<button type="button" class="menu_button menu_button_icon"></button>').attr("title", title).toggleClass("wh-on", on).html(svg(icon)).on("click", fn);
function panelRow(r) {
  const k = r.main + r.sub;
  const row = import_jquery2.default('<div class="wh-row"></div>').addClass(r.kind ? `wh-k-${r.kind}` : "").toggleClass("wh-open", openRows.has(k)).append(import_jquery2.default('<div class="wh-row-main"></div>').append(r.icon ? svg(r.icon) : "", import_jquery2.default("<span></span>").text(r.main), r.hidden ? import_jquery2.default(svg("eye-slash")).attr("title", "hidden from you") : ""));
  if (r.sub)
    row.append(import_jquery2.default('<div class="wh-row-sub"></div>').text(r.sub).attr("title", r.sub)).addClass("wh-expandable").on("click", () => {
      openRows.has(k) ? openRows.delete(k) : openRows.add(k);
      row.toggleClass("wh-open");
    });
  return row;
}
function modePicker(picked, { disabled = false, onChange }) {
  const box = import_jquery2.default('<div class="wh-modes"></div>');
  for (const [group, modes] of MODE_GROUPS) {
    const row = import_jquery2.default('<div class="wh-mode-group"></div>').addClass(`wh-g-${group.toLowerCase()}`).append(import_jquery2.default('<div class="wh-mode-group-title"></div>').text(group));
    for (const m of modes) {
      const pill = import_jquery2.default('<label class="wh-pill"></label>').toggleClass("wh-modifier", MODIFIERS.has(m)).attr("title", (MODE_BLURBS[m] || "") + (PARENT[m] ? ` (modifier: also switches on ${PARENT[m]})` : ""));
      const cb = import_jquery2.default('<input type="checkbox">').prop("checked", picked.has(m)).prop("disabled", disabled).data("mode", m);
      row.append(pill.append(cb, import_jquery2.default("<span></span>").text(m)));
    }
    box.append(row);
  }
  box.on("change", "input", () => onChange(box.find("input:checked").map((_, el) => import_jquery2.default(el).data("mode")).get()));
  return box;
}
function renderPanel() {
  if (!tab)
    return;
  const root = import_jquery2.default(tab.root);
  if (root.find('select:focus, input[type="text"]:focus, textarea:focus').length) {
    if (!panelWaiting) {
      panelWaiting = true;
      root.one("focusout", () => {
        panelWaiting = false;
        setTimeout(renderPanel, 0);
      });
    }
    return;
  }
  const scroll = root.scrollTop();
  const st = state;
  const panel = import_jquery2.default('<div class="wh-ui wh-panel"></div>');
  const live = !!st?.on;
  const power = import_jquery2.default('<label class="wh-switch wh-power" title="Worldhopper on or off"><input type="checkbox"></label>');
  power.find("input").prop("checked", live).on("change", function() {
    call("setEnabled", { value: this.checked });
  });
  panel.append(import_jquery2.default('<div class="wh-top"></div>').append(import_jquery2.default('<span class="wh-brand"></span>').append(svg("hurricane"), "Worldhopper Engine"), power));
  if (!live) {
    panel.append(import_jquery2.default('<div class="wh-tip"></div>').append(svg("power-off"), import_jquery2.default("<span></span>").html('<b>Worldhopper is off.</b> Nothing goes into your prompts and no background model runs. Moment boxes, "as …" badges and ⟲ on edited replies still show, and your modes and Ledgers are kept for when you turn it back on.')));
  }
  if (live) {
    const t = st?.target;
    const picked = new Set(st?.picks || []);
    const card = import_jquery2.default('<section class="wh-card"></section>');
    const open = pickerOpen ?? (!!t && !picked.size && !t.builder);
    card.append(import_jquery2.default('<div class="wh-head"></div>').append(import_jquery2.default('<span class="wh-title"></span>').append(svg("shapes"), "Modes ", import_jquery2.default('<span class="wh-sub"></span>').text(t ? `· ${t.label}` : "")), import_jquery2.default('<div class="wh-tools"></div>').append(helpToggle("modes"), t && !t.group ? iconBtn("wand-magic-sparkles", "Suggest modes from this character's card", suggest) : "", t ? iconBtn(open ? "check" : "pen", open ? "Done" : "Change this character's modes", () => {
      pickerOpen = !open;
      renderPanel();
    }, open) : "")));
    card.append(help("modes", `Pick the kinds of metaphysics this character uses (possession, mind control, dolls…). Worldhopper then adds the matching Codex rules to every reply in this chat, so the model knows how they work. Every mode is opt-in: nothing you didn't pick ever shows up. A character's picks are saved on its card (they travel with it); a group's are saved with the group chat.<br>${svg("pen")} changes the picks · ${svg("wand-magic-sparkles")} suggests some from the card · tap a picked mode to see what it means.`));
    const chips = import_jquery2.default('<div class="wh-picked"></div>');
    if (!t)
      chips.append('<span class="wh-empty">Open a chat to pick its modes.</span>');
    else if (t.builder && !picked.size)
      chips.append('<span class="wh-empty">This is a card builder, so it has no modes of its own.</span>');
    else if (!picked.size)
      chips.append(import_jquery2.default('<span class="wh-empty"></span>').html(`None yet. Tap ${svg("pen")} to pick some, or ${svg("wand-magic-sparkles")} to suggest them from the card. Only what you pick is ever used.`));
    else {
      for (const m of expandModes([...picked])) {
        chips.append(import_jquery2.default('<span class="wh-chip" tabindex="0"></span>').addClass(`wh-g-${groupOf(m)}`).text(m).attr("title", MODE_BLURBS[m] || "").on("click", () => {
          shownBlurb = shownBlurb === m ? null : m;
          renderPanel();
        }));
      }
    }
    if (!open || !t)
      card.append(chips);
    if (shownBlurb && picked.size && !open)
      card.append(import_jquery2.default('<div class="wh-blurb"></div>').append(import_jquery2.default("<b></b>").text(shownBlurb), `: ${MODE_BLURBS[shownBlurb] || ""}`));
    if (st?.suggestion) {
      card.append(import_jquery2.default('<div class="wh-suggestion"></div>').append(import_jquery2.default("<span></span>").text(`Suggested: ${st.suggestion.join(", ")}`), import_jquery2.default('<button type="button" class="menu_button">Apply</button>').on("click", () => call("applySuggestion"))));
    }
    if (open && t)
      card.append(modePicker(picked, { onChange: (modes) => call("setModes", { modes }) }));
    panel.append(card);
    if (st?.showLedgerCard) {
      const lc = import_jquery2.default('<section class="wh-card"></section>').append(import_jquery2.default('<div class="wh-head"></div>').append(import_jquery2.default('<span class="wh-title"></span>').append(svg("people-arrows"), "Body Ledger"), import_jquery2.default('<div class="wh-tools"></div>').append(helpToggle("ledger"), iconBtn("pen", "Open the Ledger: a card for each body, to read or change", openLedgerView), iconBtn("rotate", "Rebuild from the card and recent messages", () => call("rebuild")))));
      lc.append(help("ledger", `Keeps track of who is in which body (possession, multipossession, skinsuits, hive minds, copies, swaps) and who has which power. It updates after each reply in chats with one of those modes, and goes into the prompt so names, pronouns and every change stay straight. Each body someone takes over gets three short lines on who its owner is in their own life (look, voice and habits, life), written once by your notes model. <span class="wh-key wh-key-you"></span> teal rows are yours; <span class="wh-key wh-key-npc"></span> violet rows are someone else's. After each reply it reads only the newest messages, never the whole chat.<br>While you run more than one body, a card per body sits over the message box: tap one to start a line like <code>[Kayla] </code> for that body. A line with no name is you as a whole, and the writer only ever does what you wrote with your bodies.<br>${svg("pen")} (or the bar above the chat) opens it as cards: tap ✏️ by any part to change it, and tap a face for its picture · ${svg("rotate")} rebuilds it from the card and the last few messages.`));
      const box = import_jquery2.default('<div class="wh-box"></div>');
      for (const r of st.panel.ledgerRows)
        box.append(panelRow(r));
      for (const x of st.panel.extra)
        box.append(import_jquery2.default('<div class="wh-row-sub wh-extra"></div>').text(x));
      if (!st.panel.ledgerRows.length)
        box.prepend(import_jquery2.default('<div class="wh-empty"></div>').text(st.panel.ledgerEmpty));
      lc.append(box);
      if (st.panel.historyRows.length) {
        const hist = import_jquery2.default('<div class="wh-box wh-history"></div>').append('<div class="wh-mini-title">History</div>');
        for (const r of st.panel.historyRows)
          hist.append(panelRow(r));
        lc.append(hist);
      }
      panel.append(lc);
    }
    if (st?.showMindCard) {
      const mc = import_jquery2.default('<section class="wh-card"></section>').append(import_jquery2.default('<div class="wh-head"></div>').append(import_jquery2.default('<span class="wh-title"></span>').append(svg("brain"), "Mind Book"), import_jquery2.default('<div class="wh-tools"></div>').append(helpToggle("mind"), iconBtn("pen", "Open the Mind Book: a card for each person in it, to read or change", openMindView))));
      mc.append(help("mind", `Keeps what Hypnosis, Mind Control and Altered Perception have put into people, each in its own record: a hypnotized person's trance stage, sessions, suggestions and triggers; what a controller has set in someone's will; who can't perceive what. It updates only on replies that touch those things, and goes into the prompt with a line for the moment when it matters.<br>${svg("pen")} (or the bar above the chat) opens it as cards: tap ✏️ by any part to change it, or + to add someone.`));
      const box = import_jquery2.default('<div class="wh-box"></div>');
      for (const r of st.panel.mindRows)
        box.append(panelRow(r));
      if (st.panel.mindEmpty)
        box.append(import_jquery2.default('<div class="wh-empty"></div>').text(st.panel.mindEmpty));
      panel.append(mc.append(box));
    }
    panel.append(import_jquery2.default('<div class="wh-status"></div>').append(import_jquery2.default("<small></small>").text(st?.status?.ledger || ""), import_jquery2.default("<small></small>").text(st?.status?.timing || ""), import_jquery2.default("<small></small>").text(st?.status?.checks || "")));
    if (t && !t.group) {
      panel.append(import_jquery2.default('<div class="wh-tools" style="justify-content:flex-start"></div>').append(import_jquery2.default('<button type="button" class="menu_button"></button>').append(svg("stethoscope"), "Check card").attr("title", "Check this character's card for things that trip models up").on("click", () => checkCard(t.characterId))));
    }
  }
  const det = import_jquery2.default('<details class="wh-settings"></details>').prop("open", settingsOpen).on("toggle", function() {
    settingsOpen = this.open;
    if (this.open && !connections)
      loadConnections();
  });
  det.append(import_jquery2.default("<summary></summary>").append(svg("gear"), "Settings"));
  det.append(settingsBody());
  panel.append(det);
  root.empty().append(panel);
  root.scrollTop(scroll);
  panel.on("click keydown", ".wh-help-toggle", function(e) {
    if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ")
      return;
    e.preventDefault();
    const key = import_jquery2.default(this).attr("data-help");
    helpOpen.has(key) ? helpOpen.delete(key) : helpOpen.add(key);
    import_jquery2.default(this).toggleClass("wh-on");
    panel.find(`.wh-help[data-help="${key}"]`).toggleClass("wh-open");
  });
}
async function loadConnections() {
  try {
    connections = await call("connections");
  } catch {
    connections = { llm: [], image: [] };
  }
  renderPanel();
}
function settingsBody() {
  const s = state?.settings || { ledger: {}, pictures: {} };
  const L = s.ledger || {};
  const Pc = s.pictures || {};
  const body = import_jquery2.default("<div></div>");
  const set = (group, key) => function() {
    call("setSetting", { group, key, value: this.type === "checkbox" ? this.checked : import_jquery2.default(this).val() });
  };
  const conn = (value, empty) => {
    const sel = import_jquery2.default('<select class="text_pole"></select>').append(import_jquery2.default('<option value=""></option>').text(empty));
    for (const c of connections?.llm || [])
      sel.append(import_jquery2.default("<option></option>").val(c.id).text(`${c.name}${c.model ? ` (${c.model})` : ""}`));
    if (value && !(connections?.llm || []).some((c) => c.id === value))
      sel.append(import_jquery2.default("<option></option>").val(value).text(connections ? `${value} (missing)` : "loading…"));
    return sel.val(value || "");
  };
  const model = (connId, value, key) => {
    const id = `wh_models_${key}`;
    const input = import_jquery2.default('<input type="text" class="text_pole" placeholder="its own model">').attr("list", id).val(value || "").on("change", set("ledger", key));
    const list = import_jquery2.default("<datalist></datalist>").attr("id", id);
    for (const m of modelLists.get(connId) || [])
      list.append(import_jquery2.default("<option></option>").val(m.id));
    if (connId && !modelLists.has(connId)) {
      modelLists.set(connId, []);
      call("models", { connectionId: connId }).then((ms) => {
        modelLists.set(connId, ms || []);
      }).catch(() => {});
    }
    return import_jquery2.default("<span></span>").append(input, list);
  };
  const models = import_jquery2.default('<section class="wh-section"></section>').append(import_jquery2.default('<div class="wh-group"></div>').append(svg("microchip"), import_jquery2.default("<span>Models</span>"), helpToggle("models")), help("models", "Worldhopper's background jobs run through your connections, separate from the model you chat with. Give them their own model: a local one or a cheap, fast API model (the Flash, Haiku or mini tier). The jobs are small and the Ledger runs after every reply, so that keeps things quick and costs next to nothing; your big roleplay model would work, but at big-model prices on every reply, and your next reply waits for the Ledger. A connection can lend its key to a different model: type one in beside it. A job with no model picked simply doesn't run."), import_jquery2.default('<div class="wh-tip"></div>').append(svg("bolt"), import_jquery2.default("<span></span>").html("<b>Fast and cheap:</b> use a local or budget model here, not your roleplay model.")));
  if (connections && !connections.llm.length)
    models.append('<div class="wh-warning">No connections yet. Add one under Connections, then pick it here.</div>');
  models.append(import_jquery2.default('<label class="wh-field"></label>').append(import_jquery2.default("<span><b>Ledger &amp; suggestions</b><small>Updates the Body Ledger and the Mind Book after replies, checks replies against the Ledger, and suggests modes for new characters. Runs the most, so pick your fastest, cheapest model.</small></span>"), import_jquery2.default('<div class="wh-pair"></div>').append(conn(L.connection, "— pick a connection —").on("change", set("ledger", "connection")), model(L.connection, L.model, "model"))));
  models.append(import_jquery2.default('<label class="wh-field"></label>').append(import_jquery2.default("<span><b>Notes &amp; reviews</b><small>Writes Body History notes, host sheets and the looks pictures are drawn from, and runs Check card's deeper review. Runs rarely; a cheap model works, and a slightly better one reads a little closer.</small></span>"), import_jquery2.default('<div class="wh-pair"></div>').append(conn(L.notesConnection, "Same as Ledger").on("change", set("ledger", "notesConnection")), L.notesConnection ? model(L.notesConnection, L.notesModel, "notesModel") : import_jquery2.default("<span></span>"))));
  body.append(models);
  const sw = (key, group, checked, title, sub) => import_jquery2.default('<label class="wh-switch"></label>').append(import_jquery2.default('<input type="checkbox">').prop("checked", !!checked).on("change", set(group, key)), import_jquery2.default("<span></span>").append(import_jquery2.default("<b></b>").text(title), import_jquery2.default("<small></small>").text(sub)));
  const choices = import_jquery2.default('<section class="wh-section"></section>').append(import_jquery2.default('<div class="wh-group"></div>').append(svg("sliders"), import_jquery2.default("<span>Choices</span>"), helpToggle("choices")), help("choices", "The few things that are up to you. Everything else (the mode reminders, detail entries, the bars, the body roster, Body History, the pronoun and body-rule checks) is part of Worldhopper and runs whenever it's on. To turn all of it off at once, use the switch at the top."), import_jquery2.default('<div class="wh-switches"></div>').append(sw("enabled", "ledger", L.enabled !== false, "Body Ledger & Mind Book", "Track who is in which body, and what hypnosis, mind control and altered perception have put into people, after each reply in chats with those modes. Off, the mode rules still apply, but nothing runs in the background and your send never waits."), sw("auto", "pictures", Pc.auto, "Draw pictures on their own", "Draws each new host once their sheet is written, and each new person in the Mind Book. Off, tap anyone's face in the Ledger or the Mind Book to draw them whenever you like.")));
  const img = import_jquery2.default('<select class="text_pole"></select>').append(import_jquery2.default('<option value=""></option>').text("As Image Generation is set"));
  for (const c of connections?.image || [])
    img.append(import_jquery2.default("<option></option>").val(c.id).text(`${c.name}${c.isDefault ? " (default)" : ""}`));
  img.val(Pc.connection || "").on("change", set("pictures", "connection"));
  choices.append(import_jquery2.default('<div class="wh-field"></div>').append(import_jquery2.default("<span><b>Pictures</b><small>Drawn through one of your image connections. The look (anime, painted, photo) comes from your model or workflow; a Style is put before every picture's prompt, and a Negative goes with it where the connection takes one.</small></span>"), img, import_jquery2.default('<input type="text" class="text_pole" placeholder="Style (optional): words put before every picture prompt">').val(Pc.style || "").on("change", set("pictures", "style")), import_jquery2.default('<input type="text" class="text_pole" placeholder="Negative (optional)">').val(Pc.negative || "").on("change", set("pictures", "negative"))));
  body.append(choices);
  const b = state?.backfill || {};
  const tools = import_jquery2.default('<section class="wh-section"></section>').append(import_jquery2.default('<div class="wh-group"></div>').append(svg("toolbox"), import_jquery2.default("<span>Tools</span>")));
  const fill = import_jquery2.default('<button type="button" class="menu_button wh-wide-button"></button>').attr("title", "For a chat that started before the Ledger was on: reads the replies that have no Ledger entry yet, once each, to build the history. About 1 s per reply; tap again to stop.").append(svg(b.running ? "stop" : "clock-rotate-left"), b.running ? "Stop building" : "Build history from earlier replies").on("click", () => backfill());
  tools.append(fill);
  body.append(tools);
  return body;
}
async function suggest() {
  try {
    const r = await call("suggest");
    if (r?.error)
      notice(r.error, { kind: "warn" });
    else if (r && !r.modes?.length)
      notice(`No metaphysics modes found in ${r.label}'s card.`);
  } catch (err) {
    notice(err.message, { kind: "warn" });
  }
}
async function backfill() {
  const b = state?.backfill || {};
  if (b.running) {
    call("stopBackfill");
    return;
  }
  if (!b.all) {
    notice("Every reply already has a Ledger entry.");
    return;
  }
  if (!state?.settings?.ledger?.connection) {
    notice("Pick a Ledger model first (Settings → Models).", { kind: "warn" });
    return;
  }
  const minutes = (n) => `about ${Math.max(1, Math.ceil(n * 1.5 / 60))} min`;
  let which = "all";
  if (b.recent < b.all) {
    const m = modal("Build history");
    which = await new Promise((resolve) => {
      m.root.append(import_jquery2.default('<div class="wh-ask"></div>').append(import_jquery2.default("<p></p>").text(`${b.all} replies in this chat have no Ledger entry yet. Each is read once; replies that already have one are skipped.`), import_jquery2.default("<p></p>").html(`<b>Last 30 replies:</b> ${b.recent ? `reads ${b.recent}, ${minutes(b.recent)}.` : "nothing to read, they all have entries."}<br><b>Whole chat:</b> reads all ${b.all}, ${minutes(b.all)}.`), import_jquery2.default('<div class="wh-ask-actions"></div>').append(import_jquery2.default('<button type="button" class="menu_button">Cancel</button>').on("click", () => resolve(null)), import_jquery2.default('<button type="button" class="menu_button">Whole chat</button>').on("click", () => resolve("all")), import_jquery2.default('<button type="button" class="menu_button wh-dos-primary">Last 30 replies</button>').on("click", () => resolve("recent")))));
      m.onClose(() => resolve(null));
    });
    m.close();
    if (!which)
      return;
    if (which === "recent" && !b.recent) {
      notice("The last 30 replies already have Ledger entries.");
      return;
    }
  }
  notice(`Building the Body History (${minutes(which === "all" ? b.all : b.recent)}). You can keep reading; new replies wait their turn.`);
  call("backfill", { which });
}
var dock = null;
var composer = null;
function chipHtml(c) {
  const lead = c.face ? `<img class="wh-chip-face" src="${esc(c.face)}" alt="" loading="lazy">` : svg(c.icon);
  return `<span class="wh-chip wh-${c.kind}${c.hidden ? " wh-hidden" : ""}${c.face ? " wh-has-face" : ""}" title="${esc(c.tip)}">${lead}` + `<span class="wh-chip-text"><b>${esc(c.title)}</b><small>${esc(c.sub)}${c.hidden ? ` · hidden ${svg("eye-slash")}` : ""}</small></span></span>`;
}
function renderDocks() {
  if (!dock)
    return;
  const st = state;
  const box = import_jquery2.default(dock).empty();
  if (!st?.chatId)
    return;
  const bar = (cls, title, html, open) => import_jquery2.default(`<div class="wh-ledger-strip ${cls}" role="button" tabindex="0"></div>`).attr("title", title).html(html).on("click keydown", (e) => {
    if (e.type === "click" || e.key === "Enter")
      open();
  });
  const wrap = import_jquery2.default('<div class="wh-ui wh-docks"></div>');
  if (st.strip?.show)
    wrap.append(bar("", "Body Ledger — tap to open", st.strip.chips.map(chipHtml).join("") + (st.strip.busy ? '<span class="wh-busy">updating…</span>' : ""), openLedgerView));
  if (st.mindStrip?.show)
    wrap.append(bar("wh-mind-strip", "Mind Book — tap to open", `<span class="wh-strip-label" title="Mind Book">${svg("brain")}</span>${st.mindStrip.chips.map(chipHtml).join("")}${st.mindStrip.busy ? '<span class="wh-busy">updating…</span>' : ""}`, openMindView));
  if (wrap.children().length)
    box.append(wrap);
}
function textarea() {
  return document.querySelector('[data-component="InputArea"] textarea');
}
function renderRoster() {
  if (!composer)
    return;
  const r = state?.roster;
  const box = import_jquery2.default(composer).empty();
  if (!r?.show)
    return;
  const lanes = import_jquery2.default('<div class="wh-ui wh-lanes"></div>').toggleClass("wh-compact", r.compact);
  for (const c of r.cards) {
    const carry = c.doing || c.notes || "no line yet";
    lanes.append(import_jquery2.default('<button type="button" class="wh-lane-card"></button>').attr({ "data-name": c.name, "data-carry": carry, title: [`Start a line for ${c.name}: [${c.name}]`, c.doing, c.notes].filter(Boolean).join(`
`) }).css("--wh-hue", c.hue).append(import_jquery2.default('<span class="wh-lane-top"></span>').append('<span class="wh-lane-dot"></span>', import_jquery2.default("<b></b>").text(c.name), c.own ? "<small>(you)</small>" : ""), import_jquery2.default('<span class="wh-lane-status"></span>').text(carry)).on("click", () => addLane(c.name)));
  }
  if (!r.big) {
    lanes.append(import_jquery2.default('<button type="button" class="wh-lanes-size"></button>').attr("title", r.compact ? "Bigger cards, with what each body is doing" : "Smaller cards").html(svg(r.compact ? "up-right-and-down-left-from-center" : "down-left-and-up-right-to-center")).on("click", () => call("setSetting", { group: "ledger", key: "lanesCompact", value: !state.settings.ledger.lanesCompact })));
  }
  box.append(lanes);
  markLanes();
}
function markLanes() {
  const ta = textarea();
  const cards = composer ? import_jquery2.default(composer).find(".wh-lane-card") : import_jquery2.default();
  if (!ta || !cards.length)
    return;
  const names = cards.map((_, el) => el.dataset.name.toLowerCase()).get();
  const tagOf = (l) => {
    const m = /^\s*\[([^\]\n]+)\]\s*(.*)$/.exec(l) || /^\s*([^:\n[\]]{1,40}):\s*(.*)$/.exec(l);
    return m && names.includes(m[1].trim().toLowerCase()) ? { n: m[1].trim().toLowerCase(), text: m[2].trim() } : null;
  };
  const v = ta.value;
  const at = ta.selectionEnd ?? v.length;
  const end = v.indexOf(`
`, at);
  const cur = tagOf(v.slice(v.lastIndexOf(`
`, at - 1) + 1, end < 0 ? v.length : end));
  const has = new Set(v.split(`
`).map(tagOf).filter((x) => x?.text).map((x) => x.n));
  cards.each((_, el) => {
    const n = el.dataset.name.toLowerCase();
    import_jquery2.default(el).toggleClass("wh-on", cur?.n === n).toggleClass("wh-has", has.has(n));
    import_jquery2.default(el).find(".wh-lane-status").text(cur?.n === n ? "writing" : has.has(n) ? "has a line" : el.dataset.carry);
  });
}
function addLane(name) {
  const ta = textarea();
  if (!ta || !name)
    return;
  const v = ta.value;
  const at = ta.selectionEnd ?? v.length;
  const lineStart = v.lastIndexOf(`
`, at - 1) + 1;
  const line = v.slice(lineStart, at);
  const tag = `[${name}] `;
  if (!line.trim() || /^\s*\[[^\]\n]*\]\s*$/.test(line))
    ta.setRangeText(tag, lineStart, at, "end");
  else
    ta.setRangeText(`
${tag}`, at, at, "end");
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  ta.focus();
  markLanes();
}
var LANE_HUES = ["29, 158, 117", "127, 119, 221", "216, 90, 48", "212, 83, 126", "186, 117, 23", "55, 138, 221", "99, 153, 34", "226, 75, 74"];
var hueOf = (name) => {
  const k = String(name || "").trim().toLowerCase();
  return state?.laneHues?.[k] || LANE_HUES[1 + [...k].reduce((a, ch) => a * 31 + ch.charCodeAt(0) >>> 0, 7) % (LANE_HUES.length - 1)];
};
var startLatest = null;
var animated = new Set;
function decorate() {
  const st = state;
  const want = new Map((st?.badges || []).map((b) => [b.messageId, b.worn]));
  document.querySelectorAll(".wh-as").forEach((el) => {
    const id = el.dataset.messageId;
    if (!want.has(id) || el.dataset.worn !== want.get(id).join(", "))
      el.remove();
  });
  for (const [id, worn] of want) {
    const host = document.querySelector(`[data-spindle-mount="message_header"][data-spindle-scope^="message:${CSS.escape(id)}:"]`);
    if (!host || host.querySelector(".wh-as"))
      continue;
    const b = document.createElement("span");
    b.className = "wh-ui wh-as";
    b.dataset.messageId = id;
    b.dataset.worn = worn.join(", ");
    b.title = `You're in ${worn.join(", ")}`;
    b.innerHTML = `${svg("user")} as ${esc(worn.join(", "))}`;
    host.append(b);
  }
  const edited = new Map((st?.edited || []).map((e) => [e.messageId, e.original]));
  document.querySelectorAll(".wh-undo").forEach((el) => {
    if (!edited.has(el.dataset.messageId))
      el.remove();
  });
  for (const [id, original] of edited) {
    const host = document.querySelector(`[data-spindle-scope="message:${CSS.escape(id)}:actions"]`);
    if (!host)
      continue;
    let btn = host.querySelector(".wh-undo");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wh-undo";
      btn.dataset.messageId = id;
      btn.innerHTML = svg("rotate-left");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleEdit(id);
      });
      host.prepend(btn);
    }
    btn.classList.toggle("wh-showing-original", original);
    btn.title = original ? "Worldhopper: showing the original reply. Tap for the fixed one." : "Worldhopper: the checks fixed this reply. Tap for the original.";
  }
  document.querySelectorAll(".wh-lane").forEach((el) => {
    const name = el.querySelector(".wh-lane-name")?.textContent;
    if (name)
      el.style.setProperty("--wh-hue", hueOf(name));
  });
  const latest = ctx.messages?.getLatestMessageId?.();
  if (latest && latest !== startLatest && !animated.has(latest)) {
    const row = document.querySelector(`[data-message-id="${CSS.escape(latest)}"]`);
    const boxes = row ? row.querySelectorAll(".wh-possess, .wh-release, .wh-moment") : [];
    if (boxes.length) {
      boxes.forEach((b) => b.classList.add("wh-fresh"));
      animated.add(latest);
    }
  }
}
var decorateQueued = false;
var helloFor = undefined;
var queueDecorate = () => {
  if (decorateQueued)
    return;
  decorateQueued = true;
  requestAnimationFrame(() => {
    decorateQueued = false;
    const open = ctx.getActiveChat()?.chatId || null;
    if (open !== helloFor)
      sayHello();
    try {
      decorate();
    } catch {}
  });
};
function sayHello() {
  helloFor = ctx.getActiveChat()?.chatId || null;
  if (helloFor !== chatId) {
    state = null;
    chatId = helloFor;
    render();
  }
  startLatest = ctx.messages?.getLatestMessageId?.() || null;
  ctx.sendToBackend({ type: "rpc", id: 0, op: "hello", args: { chatId: helloFor } });
}
async function toggleEdit(messageId) {
  try {
    const r = await call("toggleEdit", { messageId });
    if (r === "original")
      notice("Original reply restored.");
    else if (r === "fixed")
      notice("Fixes re-applied.");
    else if (r === "changed")
      notice("This message was changed after it was fixed, so it can’t be toggled.", { kind: "warn" });
  } catch (err) {
    notice(err.message, { kind: "warn" });
  }
}
var liveViews = new Set;
var refreshViews = () => {
  for (const v of liveViews)
    v.render();
};
function withOpeners(data) {
  const walk = (x) => {
    if (Array.isArray(x))
      return x.forEach(walk);
    if (!x || typeof x !== "object")
      return;
    if (x.face?.open && typeof x.face.open === "string") {
      const name = x.face.open;
      const kind = x.kind || "idle";
      x.face.open = () => openPicture(name, kind);
    }
    for (const v of Object.values(x))
      if (v && typeof v === "object" && v !== x.face)
        walk(v);
  };
  walk(data);
  return data;
}
var saved = async (p) => {
  try {
    const r = await p;
    if (r === true || r && typeof r === "object" && !r.error)
      return true;
    notice(typeof r === "string" ? r : r?.error || "Not saved.", { kind: "warn" });
  } catch (err) {
    notice(err.message, { kind: "warn" });
  }
  return false;
};
function showView(kind, title, make) {
  if (!state?.chatId) {
    notice("Open a chat first.");
    return;
  }
  const m = modal(title);
  const view = {
    kind,
    render: () => {
      if (!m.root.find(".wh-dos-editing").length)
        draw();
    }
  };
  const draw = () => m.root.empty().append(make(view));
  draw();
  liveViews.add(view);
  m.onClose(() => liveViews.delete(view));
}
function openLedgerView() {
  showView("ledger", "Body Ledger", (view) => ledgerView(withOpeners(structuredClone(state.views.ledger)), {
    saveBody: (i, orig, { row, sheet }) => saved(call("saveBody", { orig, row, sheet })),
    removeBody: async (i, orig) => await confirmIt(`Take ${orig.body || orig.driver} out of the Ledger?`, "", "Remove") ? saved(call("removeBody", { orig })) : false,
    saveSheet: (name, values) => saved(call("saveSheet", { name, values })),
    deleteSheet: async (name) => await confirmIt(`Delete ${name}'s sheet?`, "", "Delete") ? saved(call("deleteSheet", { name })) : false,
    writeSheet: (name) => call("writeSheet", { name }).catch((err) => notice(err.message, { kind: "warn" })),
    makePersona,
    savePower: (i, v) => v === null ? confirmIt("Remove this power?", "", "Remove").then((ok) => ok ? saved(call("saveListItem", { list: "powers", i, value: null })) : false) : saved(call("saveListItem", { list: "powers", i, value: v })),
    saveAlias: (i, v) => v === null ? confirmIt("Remove these names?", "", "Remove").then((ok) => ok ? saved(call("saveListItem", { list: "aliases", i, value: null })) : false) : saved(call("saveListItem", { list: "aliases", i, value: v })),
    drawMissing: drawMissing2,
    refresh: () => view.render()
  }));
}
function openMindView() {
  showView("mind", "Mind Book", (view) => mindView(withOpeners(structuredClone(state.views.mind)), {
    save: (kind, i, raw, values) => saved(call("saveMind", { kind, raw, values })),
    remove: async (kind, i, raw) => await confirmIt("Take this out of the Mind Book?", "", "Remove") ? saved(call("removeMind", { kind, raw })) : false,
    drawMissing: drawMissing2,
    refresh: () => view.render()
  }));
}
async function openPicture(name, kind = "idle") {
  if (!state?.chatId)
    return;
  const m = modal(name, { width: 520 });
  let alive = true;
  const actions = {
    draw: () => call("draw", { name }).catch((err) => notice(err.message, { kind: "warn" })),
    upload: () => uploadPicture(name),
    remove: async () => {
      if (await confirmIt(`Remove ${name}'s picture?`, "", "Remove"))
        await call("removePicture", { name });
    },
    editLook: async () => {
      const look = m.root.find(".wh-dos-look span:not(.wh-dos-label):not(.wh-dos-faint)").first().text();
      const text = await ask(`How ${name} looks, for their picture`, { value: look, rows: 4 });
      if (text !== null)
        await saved(call("saveLook", { name, text }));
    }
  };
  const draw = async () => {
    let data;
    try {
      data = await call("pictureView", { name, kind });
    } catch {
      return;
    }
    if (alive)
      m.root.empty().append(pictureView(data, actions));
  };
  const view = { kind: "picture", render: draw };
  liveViews.add(view);
  m.onClose(() => {
    alive = false;
    liveViews.delete(view);
  });
  await draw();
}
async function drawMissing2(names) {
  try {
    const r = await call("drawMissing", { names });
    if (r?.drawn === r?.total)
      notice(`Drew ${r.drawn} picture${r.drawn > 1 ? "s" : ""}.`);
    else if (r)
      notice(`Drew ${r.drawn} of ${r.total} pictures. ${state?.status?.ledger || ""}`, { kind: "warn" });
  } catch (err) {
    notice(err.message, { kind: "warn" });
  }
}
async function uploadPicture(name) {
  let files;
  try {
    files = await ctx.uploads.pickFile({ accept: ["image/png", "image/jpeg", "image/webp", "image/gif"], maxSizeBytes: 15 * 1024 * 1024 });
  } catch (err) {
    notice(err.message, { kind: "warn" });
    return;
  }
  const f = files?.[0];
  if (!f)
    return;
  let bin = "";
  const bytes = f.bytes;
  for (let i = 0;i < bytes.length; i += 32768)
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  await saved(call("usePicture", { name, dataUrl: `data:${f.mimeType || "image/png"};base64,${btoa(bin)}` }));
}
async function makePersona(name) {
  const draft = await call("personaDraft", { name });
  if (!draft)
    return;
  const note = `A persona you can pick in Personas, for this chat or any other${draft.picture ? ", with their picture" : ""}. Change the description first if you like.${draft.existing ? ` You already have a persona named ${name}; this makes another.` : ""}`;
  const text = await ask(`Make a persona: ${name}`, { value: draft.text, rows: 8, ok: "Make it", note });
  if (!text?.trim())
    return;
  try {
    const r = await call("makePersona", { name, description: text });
    if (r?.error) {
      notice(r.error, { kind: "warn" });
      return;
    }
    if (r?.image && r.personaId) {
      try {
        const blob = await (await fetch(`/api/v1/images/${encodeURIComponent(r.image)}`, { credentials: "include" })).blob();
        const form = new FormData;
        form.append("avatar", blob, `${name}.png`);
        await fetch(`/api/v1/personas/${encodeURIComponent(r.personaId)}/avatar`, { method: "POST", body: form, credentials: "include" });
      } catch {}
    }
    notice(`Persona made: ${name}. It's in Personas.`);
  } catch (err) {
    notice(`Couldn't make the persona: ${err.message}`, { kind: "warn" });
  }
}
function doctorList(issues) {
  const list = import_jquery2.default('<div class="wh-doctor"></div>');
  if (!issues.length)
    return list.append(import_jquery2.default('<div class="wh-doctor-ok"></div>').append(svg("check"), "No problems found."));
  for (const i of issues) {
    list.append(import_jquery2.default(`<details class="wh-doctor-item wh-${i.level}"></details>`).append(import_jquery2.default("<summary></summary>").append(svg(i.level === "warn" ? "triangle-exclamation" : "circle-info"), import_jquery2.default("<span></span>").text(i.title)), import_jquery2.default('<div class="wh-doctor-detail"></div>').append(i.quote ? import_jquery2.default("<q></q>").text(i.quote) : "", import_jquery2.default("<div></div>").text(i.detail))));
  }
  return list;
}
async function checkCard(characterId) {
  let r;
  try {
    r = await call("checkCard", { characterId });
  } catch (err) {
    notice(err.message, { kind: "warn" });
    return;
  }
  if (r?.error) {
    notice(r.error, { kind: "warn" });
    return;
  }
  const m = modal(`Check card · ${r.name}`, { width: 760 });
  const root = import_jquery2.default('<div class="wh-cardtool"></div>');
  root.append(import_jquery2.default('<div class="wh-muted"></div>').text(`${r.always} tokens every reply · ${r.greetings} greeting${r.greetings === 1 ? "" : "s"} · modes: ${r.modes.join(", ") || "none"}`));
  root.append(doctorList(r.issues));
  const btn = import_jquery2.default('<button type="button" class="menu_button wh-card-review"></button>').append(svg("magnifying-glass"), import_jquery2.default("<span>Deeper review</span>")).attr("title", "Your notes model reads the whole card against the Codex (one request, usually under a minute)");
  const out = import_jquery2.default('<div class="wh-card-review-out"></div>');
  let running = false, ticker = null;
  btn.on("click", async () => {
    if (running) {
      call("cancelReview", { characterId });
      return;
    }
    running = true;
    const t0 = Date.now();
    const label = btn.find("span");
    const tick = () => label.text(`Reviewing… ${Math.round((Date.now() - t0) / 1000)} s · tap to cancel`);
    tick();
    ticker = setInterval(tick, 1000);
    btn.find("svg").replaceWith(svg("spinner", "wh-spin"));
    out.html('<small class="wh-muted">A thorough read usually takes under a minute.</small>');
    try {
      const res = await call("review", { characterId });
      if (res?.error)
        out.text(res.error);
      else
        out.html(import_jquery2.default("<div></div>").text(res.text).html().replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"));
    } catch (err) {
      out.text(`Couldn't run the review: ${err.message}`);
    } finally {
      clearInterval(ticker);
      running = false;
      label.text("Deeper review");
      btn.find("svg").replaceWith(svg("magnifying-glass"));
    }
  });
  m.onClose(() => {
    if (running)
      call("cancelReview", { characterId });
    clearInterval(ticker);
  });
  m.root.append(root.append(btn, out));
}
function setupCharacterTab() {
  let ct;
  try {
    ct = ctx.ui.registerCharacterEditorTab({ id: "worldhopper", title: "Worldhopper" });
  } catch {
    return;
  }
  const draw = () => {
    const s = ctx.ui.characterEditor.getState();
    const root = import_jquery2.default(ct.root).empty();
    const box = import_jquery2.default('<div class="wh-ui wh-panel"></div>').appendTo(root);
    if (!s?.characterId) {
      box.append('<div class="wh-empty">Open a character to pick its modes.</div>');
      return;
    }
    const wh = s.extensions?.worldhopper || {};
    const picked = new Set(Array.isArray(wh.modes) ? wh.modes : []);
    box.append(import_jquery2.default('<div class="wh-head"></div>').append(import_jquery2.default('<span class="wh-title"></span>').append(svg("shapes"), "Metaphysics modes")));
    box.append(import_jquery2.default('<div class="wh-empty"></div>').text("The Worldhopper Codex rules this character uses. Saved on the card, so they travel with it."));
    if (wh.tool)
      box.append(import_jquery2.default('<div class="wh-warning"></div>').text("This is a card builder: it has no modes of its own."));
    box.append(modePicker(picked, {
      onChange: (modes) => ctx.ui.characterEditor.updateExtensions((ext) => ({ ...ext, worldhopper: { ...ext?.worldhopper || {}, modes } }))
    }));
    box.append(import_jquery2.default('<div class="wh-tools" style="justify-content:flex-start;margin-top:10px"></div>').append(import_jquery2.default('<button type="button" class="menu_button"></button>').append(svg("stethoscope"), "Check card").on("click", async () => {
      await ctx.ui.characterEditor.flush?.();
      checkCard(s.characterId);
    })));
  };
  ct.onActivate(draw);
  ctx.ui.characterEditor.onChange((s) => {
    if (s.activeTabId === ct.tabId || s.open)
      draw();
  });
  draw();
}
function render() {
  renderPanel();
  renderDocks();
  renderRoster();
  queueDecorate();
  refreshViews();
}
function setup(context) {
  ctx = context;
  const removeStyle = ctx.dom.addStyle(style_default + TOAST_CSS);
  tab = ctx.ui.registerDrawerTab({
    id: "worldhopper",
    title: "Worldhopper",
    shortName: "Worldhopper",
    description: "Metaphysics modes, the Body Ledger and the Mind Book",
    keywords: ["worldhopper", "possession", "ledger", "mind book", "codex", "modes"],
    iconSvg: ICON_SVG("hurricane")
  });
  import_jquery2.default(tab.root).addClass("wh-ui");
  try {
    dock = ctx.ui.mount("chat_top_dock");
  } catch {
    dock = null;
  }
  try {
    composer = ctx.ui.mount("chat_composer_above");
  } catch {
    composer = null;
  }
  setupCharacterTab();
  ctx.onBackendMessage((p) => {
    if (!p || typeof p !== "object")
      return;
    if (p.type === "rpc") {
      const w = pending.get(p.id);
      if (!w)
        return;
      pending.delete(p.id);
      clearTimeout(w.timer);
      p.ok ? w.resolve(p.value) : w.reject(new Error(p.error || "failed"));
    } else if (p.type === "state") {
      const mine = ctx.getActiveChat()?.chatId || null;
      if (p.chatId !== mine)
        return;
      if (p.chatId !== chatId) {
        pickerOpen = null;
        shownBlurb = null;
        openRows.clear();
      }
      state = p;
      chatId = p.chatId;
      render();
    } else if (p.type === "suggested" && p.chatId === chatId) {
      notice(`Suggested modes for ${p.label}: ${p.modes.join(", ")}.`, { timeout: 20000, action: { label: "Apply", run: () => call("applySuggestion") } });
    } else if (p.type === "command") {
      if (p.id === "wh_ledger")
        openLedgerView();
      else if (p.id === "wh_mind")
        openMindView();
      else if (p.id === "wh_modes") {
        pickerOpen = true;
        tab.activate();
        renderPanel();
      } else if (p.id === "wh_check_card") {
        if (state?.target?.characterId)
          checkCard(state.target.characterId);
        else
          notice("Open a chat with a character first.");
      }
    }
  });
  sayHello();
  try {
    if (localStorage.getItem("wh-dev"))
      globalThis.__wh = { call, state: () => state };
  } catch {}
  const observer = new MutationObserver(queueDecorate);
  observer.observe(document.body, { childList: true, subtree: true });
  const onInput = (e) => {
    if (e.target?.matches?.('[data-component="InputArea"] textarea'))
      markLanes();
  };
  for (const ev of ["input", "click", "keyup", "focusin"])
    document.addEventListener(ev, onInput, true);
  return () => {
    observer.disconnect();
    for (const ev of ["input", "click", "keyup", "focusin"])
      document.removeEventListener(ev, onInput, true);
    removeStyle();
    document.querySelectorAll(".wh-as, .wh-undo, #wh_toasts").forEach((el) => el.remove());
    ctx.dom.cleanup?.();
  };
}
export {
  setup
};
