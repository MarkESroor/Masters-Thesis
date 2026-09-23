/* Install this once for the V3 menu and automatic comparison refreshes. */
function v3InstallMenu() {
  const ss = SpreadsheetApp.getActive();
  const existing = ScriptApp.getProjectTriggers().filter(function(t) {
    return t.getTriggerSourceId() === ss.getId();
  });
  const hasHandler = function(handler) {
    return existing.some(function(trigger) { return trigger.getHandlerFunction() === handler; });
  };
  if (!hasHandler('v3OnOpen')) ScriptApp.newTrigger('v3OnOpen').forSpreadsheet(ss).onOpen().create();
  if (!hasHandler('v3OnEdit')) ScriptApp.newTrigger('v3OnEdit').forSpreadsheet(ss).onEdit().create();
}
