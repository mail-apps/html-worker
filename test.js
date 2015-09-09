
var regexp = /(\/?[\w:]+)|(\[[^\]]+\])/g;
var str = '/ns1:Woshi/ns2:Hello[ns3:attr = "value"]'
for(;;) {
  var res = regexp.exec(str);
  if(!res) break;
  console.log(res[0]);
}

var NS_NAME_REGEXP = /^\/?((\w+):)?(\w+)/;
var str = '/ns1:hello';
console.log(NS_NAME_REGEXP.exec(str)[0]);

var CONDITION_REGEXP = /^\[((\w+):)?(\w+)="(.+)"\]/;
var str = '[ns1:hello="world"]';
console.log(CONDITION_REGEXP.exec(str)[0]);
