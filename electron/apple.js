'use strict';
/* ---------- Madar's events and tasks in Apple Calendar and Reminders (Mac only) ----------
 * Apps that read the Mac's calendar, like Boring Notch, then show them too. Madar owns a calendar
 * and a reminders list both called «مدار» and keeps them in step one way, except that a reminder
 * ticked off on the Mac comes back as done. apple-sync.json remembers which Apple item is which.
 * It goes through AppleScript, so the Mac asks once to let Madar control Calendar and Reminders.
 */
const { app } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const NAME = 'مدار';
const FIELDS = 11; // op, key, apple id, title, year, month, day, start minute, end minute, all day, done
const mapFile = () => path.join(app.getPath('userData'), 'apple-sync.json');
const readMap = () => { try { return { cal: {}, rem: {}, ...JSON.parse(fs.readFileSync(mapFile(), 'utf8')) }; } catch { return { cal: {}, rem: {} }; } };
const writeMap = m => fs.writeFileSync(mapFile(), JSON.stringify(m));

// the data comes in as arguments, so no title can break the script
const SCRIPT = `
on mkDate(y, m, d, mins)
	set t to current date
	set day of t to 1
	set year of t to y as integer
	set month of t to m as integer
	set day of t to d as integer
	set time of t to (mins as integer) * 60
	return t
end mkDate
on run argv
	set out to ""
	set calOn to application "Calendar" is running
	set remOn to application "Reminders" is running
	set needCal to false
	set needRem to false
	repeat with i from 1 to (count of argv) by ${FIELDS}
		if character 1 of (item i of argv) is "e" then set needCal to true
		if character 1 of (item i of argv) is "r" then set needRem to true
	end repeat
	with timeout of 600 seconds
		if needCal then
			tell application "Calendar"
				if not (exists calendar "${NAME}") then make new calendar with properties {name:"${NAME}"}
				set c to calendar "${NAME}"
				repeat with i from 1 to (count of argv) by ${FIELDS}
					set {op, k, aid, ttl, y, mo, d, s, en, ad} to items i thru (i + 9) of argv
					try
					if op is "ed" or op is "eu" then
						try
							delete (first event of c whose uid is aid)
						end try
					end if
					if op is "ec" or op is "eu" then
						if ad is "1" then
							set e to make new event at end of events of c with properties {summary:ttl, start date:my mkDate(y, mo, d, 0), end date:my mkDate(y, mo, d, 0) + days, allday event:true}
						else
							set e to make new event at end of events of c with properties {summary:ttl, start date:my mkDate(y, mo, d, s), end date:my mkDate(y, mo, d, en)}
						end if
						set out to out & "e" & tab & k & tab & (uid of e) & linefeed
					end if
					on error msg
						set out to out & "fail" & tab & k & tab & msg & linefeed
					end try
				end repeat
			end tell
		end if
		tell application "Reminders"
			if needRem and not (exists list "${NAME}") then make new list with properties {name:"${NAME}"}
			if exists list "${NAME}" then
				set L to list "${NAME}"
				repeat with i from 1 to (count of argv) by ${FIELDS}
					set {op, k, aid, ttl, y, mo, d, s, en, ad, dn} to items i thru (i + 10) of argv
					set r to missing value
					try
					if op is "rd" or op is "ru" then
						try
							set r to reminder id aid
						end try
					end if
					if op is "rd" then
						if r is not missing value then delete r
					else if op is "rc" or op is "ru" then
						if r is missing value then set r to make new reminder at end of reminders of L with properties {name:ttl}
						set name of r to ttl
						if ad is "1" then
							set allday due date of r to my mkDate(y, mo, d, 0)
						else
							set due date of r to my mkDate(y, mo, d, s)
						end if
						set completed of r to (dn is "1")
						set out to out & "r" & tab & k & tab & (id of r) & linefeed
					end if
					on error msg
						set out to out & "fail" & tab & k & tab & msg & linefeed
					end try
				end repeat
				try
					set doneIds to id of (every reminder of L whose completed is true)
					repeat with x in doneIds
						set out to out & "done" & tab & (contents of x) & linefeed
					end repeat
				end try
			end if
		end tell
	end timeout
	-- leave the Mac as it was: close what this opened
	if needCal and not calOn then tell application "Calendar" to quit
	if not remOn then tell application "Reminders" to quit
	return out
end run`;

const hash = o => JSON.stringify(o);
const ymdParts = ds => ds.split('-').map(Number);
const minutes = hm => { if (!hm) return 0; const [h, m] = hm.split(':').map(Number); return h * 60 + m; };

let running = null;
// items: { events: [{ id, title, date, start, end }], tasks: [{ id, title, due, time, done }] }
// returns the ids of Madar tasks that were ticked off on the Mac
async function sync(items) {
  if (process.platform !== 'darwin') return { done: [] };
  if (running) await running.catch(() => {});
  running = run(items);
  try { return await running; } finally { running = null; }
}
async function run({ events = [], tasks = [] }) {
  const map = readMap(), args = [];
  const add = (...f) => { while (f.length < FIELDS) f.push(''); args.push(...f.map(String)); };
  const plan = (kind, list, fields) => {
    const seen = new Set(), prefix = kind === 'cal' ? 'e' : 'r';
    for (const it of list) {
      seen.add(it.id);
      const f = fields(it), h = hash(f), was = map[kind][it.id];
      if (was?.h === h) continue;
      add(prefix + (was ? 'u' : 'c'), it.id, was?.id || '', ...f);
    }
    for (const [id, was] of Object.entries(map[kind])) if (!seen.has(id)) add(prefix + 'd', id, was.id);
  };
  plan('cal', events, e => { const [y, m, d] = ymdParts(e.date); return [e.title || 'موعد', y, m, d, minutes(e.start), e.end ? minutes(e.end) : minutes(e.start) + 60, e.start ? 0 : 1]; });
  plan('rem', tasks, t => { const [y, m, d] = ymdParts(t.due); return [t.title || 'مهمة', y, m, d, minutes(t.time), 0, t.time ? 0 : 1, t.done ? 1 : 0]; });
  const anyMapped = Object.keys(map.rem).length > 0;
  if (!args.length && !anyMapped) return { done: [] };
  const out = await new Promise((resolve, reject) => execFile('osascript', ['-e', SCRIPT, ...args], { maxBuffer: 8 << 20, timeout: 620000 }, (err, stdout, stderr) => {
    if (err) reject(new Error((stderr || err.message).trim())); else resolve(stdout);
  }));
  // remember what was sent, so only changes go next time
  const sent = new Map();
  for (let i = 0; i < args.length; i += FIELDS) sent.set(args[i + 1], args.slice(i + 3, i + FIELDS));
  const doneApple = new Set(), failed = new Set();
  for (const line of out.split('\n')) {
    const [what, k, id] = line.split('\t');
    if (what === 'done') { doneApple.add(k); continue; }
    if (what === 'fail') { failed.add(k); console.warn('apple sync item failed', k, id); continue; }
    const kind = what === 'e' ? 'cal' : what === 'r' ? 'rem' : null;
    if (!kind) continue;
    const f = sent.get(k).slice(0, kind === 'cal' ? 7 : 8).map((v, i) => (i ? Number(v) : v));
    map[kind][k] = { id, h: hash(f) };
  }
  for (let i = 0; i < args.length; i += FIELDS) {
    const [op, k] = args.slice(i, i + 2);
    if (failed.has(k)) { if (op[1] === 'u') map[op[0] === 'e' ? 'cal' : 'rem'][k].h = ''; continue; }
    if (op === 'ed') delete map.cal[k];
    if (op === 'rd') delete map.rem[k];
  }
  writeMap(map);
  const open = new Set(tasks.filter(t => !t.done).map(t => t.id));
  return { done: Object.entries(map.rem).filter(([k, v]) => open.has(k) && doneApple.has(v.id)).map(([k]) => k) };
}
// turning it off takes Madar's items back out of Calendar and Reminders
async function clear() { return sync({ events: [], tasks: [] }); }

module.exports = { sync, clear };
