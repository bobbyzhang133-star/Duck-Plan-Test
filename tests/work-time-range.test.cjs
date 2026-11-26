const test = require("node:test");
const assert = require("node:assert/strict");
const Range = require("../landing/work-time-range.js");
const values = (start, end, durationMinutes = 45) => ({ scheduledDate:start.slice(0,10),scheduledTime:start.slice(11),scheduledEndDate:end.slice(0,10),scheduledEndTime:end.slice(11),durationMinutes });

test("explicit endpoints derive existing storage fields for custom, overnight and full-day work", () => {
  for (const [start,end,minutes] of [["2030-05-02T13:15","2030-05-02T14:32",77],["2030-12-31T23:30","2031-01-01T01:00",90],["2030-05-02T10:00","2030-05-03T10:00",1440],["2030-05-02T23:55","2030-05-03T00:00",5]]) {
    assert.deepEqual(Range.read(values(start,end)),{scheduledStart:start,durationMinutes:minutes});
    const fields=Range.fromStart(start.slice(0,10),start.slice(11),minutes);assert.equal(fields.scheduledEndDate+'T'+fields.scheduledEndTime,end);
  }
});
test("floating civil endpoints preserve the existing duration model across DST and leap days", () => {
  assert.equal(Range.read(values("2027-03-14T01:30","2027-03-14T03:30")).durationMinutes,120);
  assert.equal(Range.fromStart("2028-02-29","23:30",90).scheduledEndDate,"2028-03-01");
  assert.equal(Range.fromStart("2026-11-01","01:30",60).scheduledEndTime,"02:30");
});
test("invalid, partial, reversed, too short and over-limit ranges identify the exact endpoint", () => {
  for (const [input,field] of [[values("2030-02-30T10:00","2030-03-01T11:00"),"scheduledDate"],[values("2030-05-02T25:00","2030-05-02T11:00"),"scheduledTime"],[values("2030-05-02T10:00","2030-02-30T11:00"),"scheduledEndDate"],[values("2030-05-02T10:00","2030-05-02T"),"scheduledEndTime"],[values("2030-05-02T10:00","2030-05-02T10:00"),"scheduledEndTime"],[values("2030-05-02T10:00","2030-05-02T09:00"),"scheduledEndTime"],[values("2030-05-02T10:00","2030-05-02T10:04"),"scheduledEndTime"],[values("2030-05-02T10:00","2030-05-03T10:01"),"scheduledEndDate"]]) assert.throws(()=>Range.read(input),e=>e.field===field);
  assert.deepEqual(Range.read({durationMinutes:77}),{scheduledStart:null,durationMinutes:77});
});
test("editor initializes saved custom lengths, moves the end with the start and honors an edited end", () => {
  const events={},elements=Object.fromEntries(["scheduledDate","scheduledTime","scheduledEndDate","scheduledEndTime","durationMinutes"].map(name=>[name,{value:""}]));
  const form={elements,addEventListener(name,fn){events[name]=fn;}};
  const editor=Range.createEditor(form),input=(name,value)=>{elements[name].value=value;events.input({target:{name}});};
  editor.reset("2030-05-02","23:30",77);assert.equal(elements.scheduledEndDate.value,"2030-05-03");assert.equal(elements.scheduledEndTime.value,"00:47");
  input("scheduledTime","22:00");assert.equal(elements.scheduledEndTime.value,"23:17");assert.equal(elements.scheduledEndDate.value,"2030-05-02");
  input("scheduledEndTime","23:30");assert.equal(editor.read().durationMinutes,90);
  input("scheduledDate","2030-05-04");assert.equal(elements.scheduledEndDate.value,"2030-05-04");assert.equal(elements.scheduledEndTime.value,"23:30");
  assert.equal(editor.read().durationMinutes,90);
  editor.reset("2030-05-02","19:00",45,"2030-05-02T20:15");assert.equal(elements.scheduledEndTime.value,"20:15");assert.equal(editor.read().durationMinutes,75);
});
