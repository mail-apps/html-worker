var DomUtils = require('domutils');

var JSONDomUtil = module.exports = {};

var TRANSFER_LIST = {"&lt;": '<', "&gt;": '>', "&amp;": '&',
  "&apos;": "'", "&quot;": '"'};

function transfer(str) {
  var reg = /&lt;|&gt;|&amp;|&apos;|&quot;/g;
  return str.replace(reg, function(match) {
    return TRANSFER_LIST[match];
  });
}

JSONDomUtil.getOuterHTML = function(node) {
  return DomUtils.getOuterHTML(node);
};

JSONDomUtil._addProtoForNode = function(node) {
  if(node.type === 'tag') {
    node.children.forEach(JSONDomUtil._addProtoForNode);
  }
};

JSONDomUtil.getAttribute = function(node, key) {
  return transfer(node.attribs[key]);
};

JSONDomUtil.extendElements = function(doc) {
  doc.type = 'doc';
  DomUtils.expandDoc(doc);
  doc.getElementsByTagNameNS = function(ns, name, recurse) {
    return DomUtils.getElementsByTagNameNS(ns, name, doc.dom, recurse);
  };
  // var dom = doc.dom;
  // dom.forEach(JSONDomUtil._addProtoForNode);
};

JSONDomUtil.getChildTag = function(node, ns, tagName) {
  var children = DomUtils.getElementsByTagNameNS(ns, tagName, node.children, false);
  if(children.length > 0) return children[0];
  return null;
};

JSONDomUtil.getChildTags = function(node, ns, tagName) {
  return DomUtils.getElementsByTagNameNS(ns, tagName, node.children, false);
};

JSONDomUtil.getChildTagValue = function(node, ns, tagName) {
  var children = DomUtils.getElementsByTagNameNS(ns, tagName, node.children, false);
  if(children.length > 0) return transfer(DomUtils.getText(children[0]));
  return null;
};

JSONDomUtil.getChildTagIntValue = function(node, ns, tagName) {
  if(node.type === 'doc') node = node.dom;
  var value = JSONDomUtil.getChildTagValue(node, ns, tagName);
  if(!value) return null;
  return parseInt(value);
};

JSONDomUtil.getHTML = function(doc) {
  return DomUtils.getOuterHTML(doc.dom);
}

JSONDomUtil.getText = DomUtils.getText;
JSONDomUtil.getElementsByTagNameNS = DomUtils.getElementsByTagNameNS;
var SEGMENT_REGEXP = /(\/?[\w:\*]+)|(\[[^\]]+\])/g;
var NS_NAME_REGEXP = /^\/?((\w+):)?(\w+)/;
var CONDITION_REGEXP = /^\[((\w+):)?(\w+)="(.+)"\]/;

JSONDomUtil.splitExpr = function(expr) {
  var resArray = [];
  for(;;) {
    var segmentRes = SEGMENT_REGEXP.exec(expr);
    if(!segmentRes) break;
    resArray.push(segmentRes[0]);
  }
  return resArray;
}

JSONDomUtil.getElementsByContent = function(text, element) {
  function isTextEquality(elem) {
    if(elem.children == null) return false;
    return DomUtils.getText(elem.children[0]) === text;
  };
  return DomUtils.filter(isTextEquality, element, false);
};

//XPathNSResolve function that convert namespace prefix to href
JSONDomUtil._evaluate = function(doc, expr, XPathNSResolve) {
  if(doc.dom) {
    doc = doc.dom;
  } else if (!Array.isArray(doc)) {
    doc = [doc];
  }

  return JSONDomUtil.splitExpr(expr).reduce(function(elements, str) {
    var regRes = null;
    if(str === '/*') {
      var resElements = [];
      elements.forEach(function(element) {
        if(element.children)
          resElements = resElements.concat(element.children);
      });
      return resElements;
    } else if((regRes = NS_NAME_REGEXP.exec(str)) != null) {
      var ns = regRes[2];
      if(ns) ns = XPathNSResolve(ns);
      var name = regRes[3];
      var resElements = [];
      elements.forEach(function(element) {
        if(!element || !element.children) return;
        var res = DomUtils.getElementsByTagNameNS(ns, name, element.children, false);
        resElements = resElements.concat(res);
      });
      return resElements;
    } else {
      regRes = CONDITION_REGEXP.exec(str);
      var ns = regRes[2];
      if(ns) ns = XPathNSResolve[ns];
      var name = regRes[3];
      var text = regRes[4];
      var resElements = [];
      elements.forEach(function(element) {
        if(!element || !element.children) return;
        var nodes = JSONDomUtil.getElementsByContent(text, element.children);
        if(nodes.length > 0)
          resElements.push(element);
      });
      return resElements;
    }
  }, [{children: doc}]);
};

var NSDef = require('./ns');

JSONDomUtil.nevaluate = function(doc, expr) {
  return JSONDomUtil._evaluate(doc, expr, function(prefix) {
    return NSDef[prefix] || null;
  });
};
