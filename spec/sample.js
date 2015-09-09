'use strict';
var DomUtils = require('domutils');
var JSONDomUtils = require('../lib/JSONDomUtils');
var path = require('path');

function getXmlArrayBuffer(filename, callback) {
  var request = new XMLHttpRequest();
  request.open('GET', path.join('/base/spec/', filename));
  request.responseType = 'arraybuffer';
  request.send();
  request.addEventListener('load', function(e) {
    callback(request.response);
  });
}

describe('DomParserWorker', function() {
  describe('normal xml arraybuffer', function() {
    var worker = null, data = null;

    beforeEach(function(done) {
      worker = new Worker('/base/dist/DomParserWorker.js');
      worker.addEventListener('message', function(e) {
        data = e.data;
        if(data.cmd === 'print') console.log(data.args);
        else if(data.cmd === 'throw') throw data.args;
        else done();
      });
      getXmlArrayBuffer('fixture.xml', function(xml) {
        worker.postMessage({cmd: 'parse-dom', id: 0, args: xml});
      });
    });

    afterEach(function() {
      worker.terminate();
    });

    it('post xml to worker', function() {
      // console.log(e.data);
      expect(data.cmd).toBe('return-result');
      expect(data.id).toBe(0);
      var dom = data.args.dom;
      expect(dom).toBeTruthy();

      var elements = DomUtils.getElementsByTagName('Root', dom, true);
      expect(elements.length).toBe(1);
      elements = DomUtils.getElementsByTagName('Hello', dom, true);
      expect(elements.length).toBe(1);
      elements = DomUtils.getElementsByTagName('World', dom, true);
      expect(elements.length).toBe(1);
    });
  });

  describe('namespace xml arraybuffer', function() {
    var worker = null, data = null;

    beforeEach(function(done) {
      worker = new Worker('/base/dist/DomParserWorker.js');
      worker.addEventListener('message', function(e) {
        data = e.data;
        if(data.cmd === 'print') console.log(data.args);
        else if(data.cmd === 'throw') throw data.args;
        else done();
      });
      getXmlArrayBuffer('fixture-ns.xml', function(xml) {
        worker.postMessage({cmd: 'parse-dom', id: 0, args: xml});
      });
    });

    afterEach(function() {
      worker.terminate();
    });

    it('post a namespace xml arraybuffer', function() {
      expect(data.cmd).toBe('return-result');
      var doc = DomUtils.expandDoc(data.args);

      var nodes = DomUtils.getElementsByTagNameNS(null, 'root', doc.dom);
      expect(nodes.length).toBe(1);

      var nodes = DomUtils.getElementsByTagNameNS('namespace1', 'node1', doc.dom);
      expect(nodes.length).toBe(1);

      nodes = DomUtils.getElementsByTagNameNS('namespace2', 'node3', doc.dom);
      expect(nodes.length).toBe(1);

      nodes = DomUtils.getElementsByTagNameNS('namespace-default', 'node5', doc.dom);
      expect(nodes.length).toBe(1);
    });

    it('get elements by JSONDomUtils', function() {
      // var doc = DomUtils.expandDoc(data.args);
      var doc = data.args;
      JSONDomUtils.extendElements(doc);
      var node = JSONDomUtils.getChildTag(doc.dom, 'namespace1', 'node1');
      expect(node).toBeTruthy();
      expect(node.getAttribute('details')).toBe('get ns1');

      var node = JSONDomUtils.getChildTag(doc.dom, 'namespace-default', 'node5');
      expect(node.getAttribute('details')).toBe('get default namespace');

      var node = JSONDomUtils.getChildTag(doc.dom, 'namespace1', 'node6');
      expect(node.getAttribute('details')).toBe('get ns1 again');

      var str = JSONDomUtils.getChildTagValue(doc.dom, 'namespace1', 'node6');
      expect(str).toBe('Hello, Goodbye');

      expect(node.getTextContent()).toBe('Hello, Goodbye');
      console.log(JSONDomUtils.getHTML(doc));
    });

    it('get elements by evaluate', function() {
      var doc = data.args;
      JSONDomUtils.extendElements(doc);

      var expr = '/*/ns1:node1/ns2:node2/ns2:node3/default:node4/default:node5[ns1:node6="Hello, Goodbye"]';
      var resArray = JSONDomUtils.splitExpr(expr);
      expect(resArray.length).toBe(7);
      console.log(resArray);

      var node6 = JSONDomUtils.getChildTag(doc.dom, 'namespace1', 'node6');
      var nodes = JSONDomUtils.getElementsByContent('Hello, Goodbye', node6);
      expect(nodes.length).toBe(1);

      var nodes = JSONDomUtils._evaluate(doc, expr, function(prefix) {
        var map = {ns1: 'namespace1', ns2: 'namespace2', 'default': 'namespace-default'};
        return map[prefix];
      });
      expect(nodes.length).toBe(1);
    });
  });
});
