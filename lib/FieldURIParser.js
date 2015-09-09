var JSONDomUtils = require('./JSONDomUtils')
var ns = require('./ns');

var nsTypes = ns.nsTypes;

const Tag_PidTagLastVerbExecuted = "0x1081";
const PidTagLastModificationTime = "0x3008";
const Tag_PidTagFlagStatus  = "0x1090"; // https://msdn.microsoft.com/en-us/library/bb821036.aspx
const PidTagAdditionalRenEntryIds  = '0x36D8'; //https://msdn.microsoft.com/en-us/library/ee159224(v=exchg.80).aspx

// ExtendedFieldURI https://msdn.microsoft.com/en-us/library/aa564843(v=exchg.80).aspx
var FieldURI = {
  queryProperty: function(item, propertyTag) {
    var epArray = JSONDomUtils.getElementsByTagNameNS(nsTypes, 'ExtendedProperty', item);
    for(var i = 0; epArray && (i != epArray.length); ++i) {
      var eTag = epArray[i];
      var eFUTag = JSONDomUtils.getChildTag(eTag, nsTypes, 'ExtendedFieldURI');
      if(parseInt(JSONDomUtils.getAttribute(eFUTag, "PropertyTag")) === parseInt(propertyTag)) {
        return eTag;
      }
    }
    return null;
  },

  queryPropertyValue: function(item, propertyTag) {
    var eTag = FieldURI.queryProperty(item, propertyTag);
    if (eTag) {
      return JSONDomUtils.getChildTagValue(eTag, nsTypes, 'Value');
    }
    return null;
  },

  queryPropertyValueList: function(item, propertyTag) {
    var eTag = FieldURI.queryProperty(item, propertyTag);
    var ret = [];
    if (!eTag) {
      return ret;
    }
    var valArray = JSONDomUtils.getElementsByTagNameNS(nsTypes, 'Value', eTag);
    for (var i = 0; valArray && (i != valArray.length); ++i) {
      ret.push(JSONDomUtils.getText(valArray[i]));
    }
    return ret;
  },
};

var ExchangeMessageInfo = {
  toInt: function(val) {
    if (typeof val === 'string') {
      if (val === 'true') {
        return 1;
      }
      if (val === 'false') {
        return 0;
      }
      return parseInt(val, 10);
    }
    return null;
  },

  isMeetingRequest: function(itemClass) {
    return itemClass == 'IPM.Schedule.Meeting.Request'
           || itemClass == 'IPM.Schedule.Meeting.Canceled' 
           || itemClass == 'IPM.Schedule.Meeting.Resp.Neg'
           || itemClass == 'IPM.Schedule.Meeting.Resp.Pos'
           || itemClass == 'IPM.Schedule.Meeting.Resp.Tent';
  },
  
  isEmailMessage: function(itemClass) {
    return itemClass == 'IPM.Note';
  },
  
  isDeliveryReport: function(itemClass) {
    return itemClass == 'REPORT.IPM.Note.DR' || itemClass == 'REPORT.IPM.Note.NDR';
  },
  
  isAcceptItemClass: function(itemClass) {
    return this.isEmailMessage(itemClass) || this.isMeetingRequest(itemClass) || this.isDeliveryReport(itemClass);
  },

  updateDateForTask: function(item) {
    var dateTimeString = item.dateTimeReceived || item.dateTimeCreated || item.dateTimeSent;
    item.dateForTask = (new Date(dateTimeString)).getTime();
  },

  getProperties: function(msg) {
    let itemIdTag = JSONDomUtils.getChildTag(msg, nsTypes, 'ItemId');
    if (!itemIdTag) { /* It's for handling Delete */
      itemIdTag = msg;
    }
    if (!JSONDomUtils.getAttribute(itemIdTag, "ChangeKey")) {
      return null;
    }
    let mimeContent =  JSONDomUtils.getChildTagValue(msg, nsTypes, 'MimeContent');
    var item = {};
    if (mimeContent) {
      item.mimeContent = mimeContent;
    } else {
      item = {
        importance: JSONDomUtils.getChildTagValue(msg, nsTypes, 'Importance'),
        isDraft: this.toInt(JSONDomUtils.getChildTagValue(msg, nsTypes, 'IsDraft')),
        isRead: this.toInt(JSONDomUtils.getChildTagValue(msg, nsTypes, 'IsRead')),
        itemClass: JSONDomUtils.getChildTagValue(msg, nsTypes, 'ItemClass'),
        disposition: FieldURI.queryPropertyValue(msg, Tag_PidTagLastVerbExecuted),
        dateTimeReceived: JSONDomUtils.getChildTagValue(msg, nsTypes, 'DateTimeReceived'),
        dateTimeCreated: JSONDomUtils.getChildTagValue(msg, nsTypes, 'DateTimeCreated'),
        dateTimeSent: JSONDomUtils.getChildTagValue(msg, nsTypes, 'DateTimeSent'),
        hasAttachments: this.toInt(JSONDomUtils.getChildTagValue(msg, nsTypes, 'HasAttachments')),
        lastModifiedTime: FieldURI.queryPropertyValue(msg, PidTagLastModificationTime),
        size: this.toInt(JSONDomUtils.getChildTagValue(msg, nsTypes, 'Size')),
        // null = flwupNone; 1 = followupComplete, 2 = followupFlagged
        flag: FieldURI.queryPropertyValue(msg, Tag_PidTagFlagStatus ),
      };
      ExchangeMessageInfo.updateDateForTask(item);
    }
    item.itemId = JSONDomUtils.getAttribute(itemIdTag, "Id");
    item.changeKey = JSONDomUtils.getAttribute(itemIdTag, "ChangeKey");

    return item;
  },

  getFromDocument: function(doc) {
    //log.info(DomUtil.serializeToString(doc));
    let msgs = doc.getElementsByTagNameNS(nsTypes, 'Message');
    // mr is short for meeting request / response
    let mreqs = doc.getElementsByTagNameNS(nsTypes, 'MeetingRequest');
    let mress = doc.getElementsByTagNameNS(nsTypes, 'MeetingResponse');
    msgs = Array.concat(msgs, mreqs, mress);

    let messages = [];
    for (let i = 0; i < msgs.length; ++i) {
      var item = ExchangeMessageInfo.getProperties(msgs[i]);
      if (item && ExchangeMessageInfo.isAcceptItemClass(item.itemClass)) {
        messages.push(item);
      }
    }
    return messages;
  },
};

var ExchangeFolderInfo = {
  getProperties: function(folderTag) {
    if (!folderTag) return null;

    var folderClass = JSONDomUtils.getChildTagValue(folderTag, nsTypes, 'FolderClass');
    if (folderClass && folderClass !== 'IPF.Note') return null;

    var folderIdTag = JSONDomUtils.getChildTag(folderTag, nsTypes, 'FolderId');
    var parentFolderIdTag = JSONDomUtils.getChildTag(folderTag, nsTypes, 'ParentFolderId');
    var parentFolderId = JSONDomUtils.getAttribute(parentFolderIdTag, 'Id');
    let resFolder = {
      folderId:   JSONDomUtils.getAttribute(folderIdTag, "Id"),
      changeKey:  JSONDomUtils.getAttribute(folderIdTag, "ChangeKey"),
      displayName: JSONDomUtils.getChildTagValue(folderTag, nsTypes, "DisplayName"),
      totalCount: JSONDomUtils.getChildTagIntValue(folderTag, nsTypes, "TotalCount") || 0,
      childFolderCount: JSONDomUtils.getChildTagIntValue(folderTag, nsTypes, "ChildFolderCount") || 0,
      unreadCount: JSONDomUtils.getChildTagIntValue(folderTag, nsTypes, "UnreadCount") || 0,
      parentFolderId: parentFolderId,
      folderClass: folderClass,
      additionalRenEntryIds: FieldURI.queryPropertyValueList(folderTag, PidTagAdditionalRenEntryIds),
    };
    return resFolder;
  },
};

module.exports = {
  ExchangeMessageInfo: ExchangeMessageInfo,
  ExchangeFolderInfo: ExchangeFolderInfo
};
