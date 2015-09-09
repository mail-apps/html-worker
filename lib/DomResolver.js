var FieldURIParser = require('./FieldURIParser');
var JSONDomUtils = require('./JSONDomUtils');
var ns = require('./ns');
var SoapError = require('./error');

var nsMessages = ns.nsMessages;
var nsTypes = ns.nsTypes;
var ExchangeMessageInfo = FieldURIParser.ExchangeMessageInfo;
var ExchangeFolderInfo = FieldURIParser.ExchangeFolderInfo;

var resolveDoc = function(doc) {
  JSONDomUtils.extendElements(doc);
  var xpath = '/nsSoap:Envelope/nsSoap:Body/*/nsMessages:ResponseMessages';
  var responses = JSONDomUtils.nevaluate(doc, xpath)[0];
  let childNode = responses.children[0];
  if (JSONDomUtils.getAttribute(childNode, 'ResponseClass') === 'Error') {
    let msgText = JSONDomUtils.getChildTagValue(childNode, nsMessages, 'MessageText');
    let code = JSONDomUtils.getChildTagValue(childNode, nsMessages, 'ResponseCode');
    var error = new SoapError(msgText);
    error.code = code;
    throw error;
  }
  doc.responseNode = childNode;
  return doc;
};

// Exchange can return several Message result when getItems, not all response Class is Success.
var resolveMsgsDoc = function(doc) {
  JSONDomUtils.extendElements(doc);
  var xpath = '/nsSoap:Envelope/nsSoap:Body/*/nsMessages:ResponseMessages';
  var responses = JSONDomUtils.nevaluate(doc, xpath)[0];
  let childNodes = responses.children;
  var errorChildNode = null;
  // All childNode return Error then throw the last get Error;
  var isError = childNodes.every(function (childNode) {
    if (JSONDomUtils.getAttribute(childNode, 'ResponseClass') === 'Error') {
      errorChildNode = childNode;
      return true;
    }
    else
      return false;
  });

  if (isError && errorChildNode) {
    // dump('All message repsonse return Error \n');
    let msgText = JSONDomUtils.getChildTagValue(errorChildNode, nsMessages, 'MessageText');
    let code = JSONDomUtils.getChildTagValue(errorChildNode, nsMessages, 'ResponseCode');
    var error = new SoapError(msgText);
    error.code = code;
    throw error;
  }
  return doc;
};

var convertToBool = function(value) {
  if (value === 'false') return false;
  return true;
};

const SyncFlags = {
  CREATED: 1,
  UPDATED: 2,
  DELETED: 3,
};

module.exports = {
  getMessage: function(doc) {
    doc = resolveMsgsDoc(doc);
    return ExchangeMessageInfo.getFromDocument(doc);
  },
  syncFolderItems: function(doc) {
    doc = resolveDoc(doc);

    var syncNode = doc.responseNode;
    var syncRes = {};

    syncRes.syncState = JSONDomUtils.getChildTagValue(syncNode, nsMessages, 'SyncState');
    syncRes.lastItemInRange = convertToBool(
      JSONDomUtils.getChildTagValue(syncNode, nsMessages, "IncludesLastItemInRange"));
    var changesTag = JSONDomUtils.getChildTag(syncNode, nsMessages, 'Changes');

    var createMsgs = JSONDomUtils.getChildTags(changesTag, nsTypes, 'Create');
    syncRes.creates = processMsgIds(createMsgs);

    var updateMsgs = JSONDomUtils.getChildTags(changesTag, nsTypes, 'Update');
    syncRes.updates = processMsgIds(updateMsgs);

    var deleteMsgs = JSONDomUtils.getChildTags(changesTag, nsTypes, 'Delete');
    syncRes.deletes = processMsgIds(deleteMsgs, true);
    //according to msdn, the response XML has ReadStateChange node,
    //but according to my test, where are not ReadStateChange node, and the readFlag
    //changes is recorded in Update tags

    return syncRes;
    function processMsgIds(msgTags, isDelete) {
      var resArray = [];
      for (var i = 0; i < msgTags.length; ++i) {
        var item = ExchangeMessageInfo.getProperties(msgTags[i].children[0])
        if (item && (ExchangeMessageInfo.isAcceptItemClass(item.itemClass) || isDelete)) {
          resArray.push(item);
        }
      }
      return resArray;
    }
  },

  findMessages: function(doc) {
    doc = resolveMsgsDoc(doc);
    return ExchangeMessageInfo.getFromDocument(doc);
  },

  syncFolders: function(doc) {
    doc = resolveDoc(doc);
    var syncRes = {};
    var syncNode = doc.responseNode;
    syncRes.syncState = JSONDomUtils.getChildTagValue(syncNode, nsMessages, 'SyncState');
    syncRes.lastItemInRange = convertToBool(
      JSONDomUtils.getChildTagValue(syncNode, nsMessages, "IncludesLastFolderInRange"));
    var changesTag = JSONDomUtils.getChildTag(syncNode, nsMessages, 'Changes');

    var processFolders = function(folderTags, stateChange) {
      var resArray = [];
      for (var i = 0; folderTags && (i < folderTags.length); ++i) {
        var folderTag = folderTags[i];
        var folder = JSONDomUtils.getChildTag(folderTag, nsTypes, 'Folder');
        var ret = ExchangeFolderInfo.getProperties(folder);
        if (ret) {
          ret.stateChange = stateChange;
          resArray.push(ret);
        }
      }
      return resArray;
    };

    var processFolderIds = function(folderTags, stateChange) {
      var resArray = [];
      for (var i = 0; folderTags && (i < folderTags.length); ++i) {
        var folderTag = folderTags[i];
        var folderId = JSONDomUtils.getChildTag(folderTag, nsTypes, 'FolderId');
        if (folderId) {
          resArray.push({
            stateChange: stateChange,
            folderId:   JSONDomUtils.getAttribute(folderId, "Id"),
            changeKey:  JSONDomUtils.getAttribute(folderId, "ChangeKey"),
          });
        } else {
          dump('Abnormal Delete:' + JSONDomUtils.getOuterHTML(folderTag) + '\n');
        }
      }
      return resArray;
    };

    var createFolders = JSONDomUtils.getChildTags(changesTag, nsTypes, 'Create');
    syncRes.creates = processFolders(createFolders, SyncFlags.CREATED);

    var updateFolders = JSONDomUtils.getChildTags(changesTag, nsTypes, 'Update');
    syncRes.updates = processFolders(updateFolders, SyncFlags.UPDATED);

    var deleteFolders = JSONDomUtils.getChildTags(changesTag, nsTypes, 'Delete');
    syncRes.deletes = processFolderIds(deleteFolders, SyncFlags.DELETED);
    // postMessage({cmd: 'print', args: JSON.stringify(syncRes.creates)});
    return syncRes;
  }
}
