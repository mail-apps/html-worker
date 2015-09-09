var htmlparser = require("htmlparser2");
var DomHandler = require('domhandler');
var UTF8ArrToStr = require('./UTF8ArrToStr');
var DomResolver = require('./DomResolver');
var SoapError = require('./error');

function printLog(str) {
  postMessage({cmd: 'print', args: str});
}

function printError(error) {
  postMessage({cmd: 'throw', args: error.toString()});
}

function parseDom(buffer, callback) {
  var domStr = UTF8ArrToStr(new Uint8Array(buffer));
  var handler = new DomHandler(callback);
  var parser = new htmlparser.Parser(handler, {xmlMode: true});
  parser.write(domStr);
  parser.done();
}

function DomParserTasks() {
  this.freeTaskIdList = [];
  this.tasks = new Map;
  this.inProcessTaskId = null;
}

DomParserTasks.prototype.addTask = function(info) {
  if(info.id == null) return;
  var taskId = info.id;
  if(this.tasks.has(taskId))
    throw new Error('id "' + taskId + '" is Existing!');
  var params = {buffer: info.args, method: info.method};
  this.tasks.set(taskId, params);
  this.freeTaskIdList.push(taskId);
  this.pumpTasks();
};

function simplifyDom(node) {
  if(node.type !== 'tag') return;
  delete node.defaultNS;
  if(node.children)
    node.children.forEach(simplifyDom);
}

function simplifyDoc(doc) {
  delete doc.namespaces.nsMap;
  doc.dom.forEach(simplifyDom);
  return doc;
}

function parseDoc(doc, taskArgs) {
  var method = taskArgs.method;
  if(method) {
    var handler = DomResolver[method];
    if(handler) return handler(doc);
  }
  return doc;
}

DomParserTasks.prototype.runTask = function(taskId, taskArgs) {
  var onDomParseEnd = function(taskId, err, doc) {
    if (err) {
      var errorInfo = {name: 'Error', message: err.toString()};
      postMessage({cmd: 'return-error', id: taskId, args: errorInfo});
    } else {
      try {
        simplifyDoc(doc);
        var res = parseDoc(doc, taskArgs);
        postMessage({cmd: 'return-result', id: taskId, args: res});
      } catch(err) {
        if(err.name === 'SoapError') {
          errorInfo = {name: 'SoapError', stack: err.stack, message: err.toString(), code: err.code};
          postMessage({cmd: 'return-error', id: taskId, args: errorInfo});
        } else {
          printError(err.stack);
        }
      }
    }
    this.tasks.delete(taskId);
    this.inProcessTaskId = null;
    this.pumpTasks();
  };
  parseDom(taskArgs.buffer, onDomParseEnd.bind(this, taskId));
};

DomParserTasks.prototype.pumpTasks = function() {
  if(this.inProcessTask != null) return;
  if(this.freeTaskIdList.length <= 0) return;
  //get a task from freeTaskIdList and prepare to run
  var taskId = this.freeTaskIdList.shift();
  var taskArgs = this.tasks.get(taskId);
  this.inProcessTaskId = taskId;
  this.runTask(taskId, taskArgs);
};

self.domParserTasks = new DomParserTasks;

// the format of message is {cmd: 'parse-dom', id: <taskId>, args: <buffer>}
self.addEventListener('message', function(e) {
  var data = e.data;
  if(data.cmd === 'parse-dom')
    self.domParserTasks.addTask(data);
});
