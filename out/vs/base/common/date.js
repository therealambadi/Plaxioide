import { localize } from "../../nls.js";
import { LANGUAGE_DEFAULT } from "./platform.js";
const minute = 60;
const hour = minute * 60;
const day = hour * 24;
const week = day * 7;
const month = day * 30;
const year = day * 365;
function fromNow(date, appendAgoLabel, useFullTimeWords, disallowNow) {
  if (typeof date !== "number") {
    date = date.getTime();
  }
  const seconds = Math.round(((/* @__PURE__ */ new Date()).getTime() - date) / 1e3);
  if (seconds < -30) {
    return localize("date.fromNow.in", "in {0}", fromNow((/* @__PURE__ */ new Date()).getTime() + seconds * 1e3, false));
  }
  if (!disallowNow && seconds < 30) {
    return localize("date.fromNow.now", "now");
  }
  let value;
  if (seconds < minute) {
    value = seconds;
    if (appendAgoLabel) {
      if (value === 1) {
        return useFullTimeWords ? localize("date.fromNow.seconds.singular.ago.fullWord", "{0} second ago", value) : localize("date.fromNow.seconds.singular.ago", "{0} sec ago", value);
      } else {
        return useFullTimeWords ? localize("date.fromNow.seconds.plural.ago.fullWord", "{0} seconds ago", value) : localize("date.fromNow.seconds.plural.ago", "{0} secs ago", value);
      }
    } else {
      if (value === 1) {
        return useFullTimeWords ? localize("date.fromNow.seconds.singular.fullWord", "{0} second", value) : localize("date.fromNow.seconds.singular", "{0} sec", value);
      } else {
        return useFullTimeWords ? localize("date.fromNow.seconds.plural.fullWord", "{0} seconds", value) : localize("date.fromNow.seconds.plural", "{0} secs", value);
      }
    }
  }
  if (seconds < hour) {
    value = Math.floor(seconds / minute);
    if (appendAgoLabel) {
      if (value === 1) {
        return useFullTimeWords ? localize("date.fromNow.minutes.singular.ago.fullWord", "{0} minute ago", value) : localize("date.fromNow.minutes.singular.ago", "{0} min ago", value);
      } else {
        return useFullTimeWords ? localize("date.fromNow.minutes.plural.ago.fullWord", "{0} minutes ago", value) : localize("date.fromNow.minutes.plural.ago", "{0} mins ago", value);
      }
    } else {
      if (value === 1) {
        return useFullTimeWords ? localize("date.fromNow.minutes.singular.fullWord", "{0} minute", value) : localize("date.fromNow.minutes.singular", "{0} min", value);
      } else {
        return useFullTimeWords ? localize("date.fromNow.minutes.plural.fullWord", "{0} minutes", value) : localize("date.fromNow.minutes.plural", "{0} mins", value);
      }
    }
  }
  if (seconds < day) {
    value = Math.floor(seconds / hour);
    if (appendAgoLabel) {
      if (value === 1) {
        return useFullTimeWords ? localize("date.fromNow.hours.singular.ago.fullWord", "{0} hour ago", value) : localize("date.fromNow.hours.singular.ago", "{0} hr ago", value);
      } else {
        return useFullTimeWords ? localize("date.fromNow.hours.plural.ago.fullWord", "{0} hours ago", value) : localize("date.fromNow.hours.plural.ago", "{0} hrs ago", value);
      }
    } else {
      if (value === 1) {
        return useFullTimeWords ? localize("date.fromNow.hours.singular.fullWord", "{0} hour", value) : localize("date.fromNow.hours.singular", "{0} hr", value);
      } else {
        return useFullTimeWords ? localize("date.fromNow.hours.plural.fullWord", "{0} hours", value) : localize("date.fromNow.hours.plural", "{0} hrs", value);
      }
    }
  }
  if (seconds < week) {
    value = Math.floor(seconds / day);
    if (appendAgoLabel) {
      return value === 1 ? localize("date.fromNow.days.singular.ago", "{0} day ago", value) : localize("date.fromNow.days.plural.ago", "{0} days ago", value);
    } else {
      return value === 1 ? localize("date.fromNow.days.singular", "{0} day", value) : localize("date.fromNow.days.plural", "{0} days", value);
    }
  }
  if (seconds < month) {
    value = Math.floor(seconds / week);
    if (appendAgoLabel) {
      if (value === 1) {
        return useFullTimeWords ? localize("date.fromNow.weeks.singular.ago.fullWord", "{0} week ago", value) : localize("date.fromNow.weeks.singular.ago", "{0} wk ago", value);
      } else {
        return useFullTimeWords ? localize("date.fromNow.weeks.plural.ago.fullWord", "{0} weeks ago", value) : localize("date.fromNow.weeks.plural.ago", "{0} wks ago", value);
      }
    } else {
      if (value === 1) {
        return useFullTimeWords ? localize("date.fromNow.weeks.singular.fullWord", "{0} week", value) : localize("date.fromNow.weeks.singular", "{0} wk", value);
      } else {
        return useFullTimeWords ? localize("date.fromNow.weeks.plural.fullWord", "{0} weeks", value) : localize("date.fromNow.weeks.plural", "{0} wks", value);
      }
    }
  }
  if (seconds < year) {
    value = Math.floor(seconds / month);
    if (appendAgoLabel) {
      if (value === 1) {
        return useFullTimeWords ? localize("date.fromNow.months.singular.ago.fullWord", "{0} month ago", value) : localize("date.fromNow.months.singular.ago", "{0} mo ago", value);
      } else {
        return useFullTimeWords ? localize("date.fromNow.months.plural.ago.fullWord", "{0} months ago", value) : localize("date.fromNow.months.plural.ago", "{0} mos ago", value);
      }
    } else {
      if (value === 1) {
        return useFullTimeWords ? localize("date.fromNow.months.singular.fullWord", "{0} month", value) : localize("date.fromNow.months.singular", "{0} mo", value);
      } else {
        return useFullTimeWords ? localize("date.fromNow.months.plural.fullWord", "{0} months", value) : localize("date.fromNow.months.plural", "{0} mos", value);
      }
    }
  }
  value = Math.floor(seconds / year);
  if (appendAgoLabel) {
    if (value === 1) {
      return useFullTimeWords ? localize("date.fromNow.years.singular.ago.fullWord", "{0} year ago", value) : localize("date.fromNow.years.singular.ago", "{0} yr ago", value);
    } else {
      return useFullTimeWords ? localize("date.fromNow.years.plural.ago.fullWord", "{0} years ago", value) : localize("date.fromNow.years.plural.ago", "{0} yrs ago", value);
    }
  } else {
    if (value === 1) {
      return useFullTimeWords ? localize("date.fromNow.years.singular.fullWord", "{0} year", value) : localize("date.fromNow.years.singular", "{0} yr", value);
    } else {
      return useFullTimeWords ? localize("date.fromNow.years.plural.fullWord", "{0} years", value) : localize("date.fromNow.years.plural", "{0} yrs", value);
    }
  }
}
function fromNowByDay(date, appendAgoLabel, useFullTimeWords) {
  if (typeof date !== "number") {
    date = date.getTime();
  }
  const todayMidnightTime = /* @__PURE__ */ new Date();
  todayMidnightTime.setHours(0, 0, 0, 0);
  const yesterdayMidnightTime = new Date(todayMidnightTime.getTime());
  yesterdayMidnightTime.setDate(yesterdayMidnightTime.getDate() - 1);
  if (date > todayMidnightTime.getTime()) {
    return localize("today", "Today");
  }
  if (date > yesterdayMidnightTime.getTime()) {
    return localize("yesterday", "Yesterday");
  }
  return fromNow(date, appendAgoLabel, useFullTimeWords);
}
function getDurationString(ms, useFullTimeWords) {
  const seconds = Math.abs(ms / 1e3);
  if (seconds < 1) {
    return useFullTimeWords ? localize("duration.ms.full", "{0} milliseconds", ms) : localize("duration.ms", "{0}ms", ms);
  }
  if (seconds < minute) {
    return useFullTimeWords ? localize("duration.s.full", "{0} seconds", Math.round(ms) / 1e3) : localize("duration.s", "{0}s", Math.round(ms) / 1e3);
  }
  if (seconds < hour) {
    return useFullTimeWords ? localize("duration.m.full", "{0} minutes", Math.round(ms / (1e3 * minute))) : localize("duration.m", "{0} mins", Math.round(ms / (1e3 * minute)));
  }
  if (seconds < day) {
    return useFullTimeWords ? localize("duration.h.full", "{0} hours", Math.round(ms / (1e3 * hour))) : localize("duration.h", "{0} hrs", Math.round(ms / (1e3 * hour)));
  }
  return localize("duration.d", "{0} days", Math.round(ms / (1e3 * day)));
}
function toLocalISOString(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0") + "T" + String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0") + ":" + String(date.getSeconds()).padStart(2, "0") + "." + (date.getMilliseconds() / 1e3).toFixed(3).slice(2, 5) + "Z";
}
const safeIntl = {
  DateTimeFormat(locales, options) {
    try {
      return new Intl.DateTimeFormat(locales, options);
    } catch {
      return new Intl.DateTimeFormat(void 0, options);
    }
  },
  Collator(locales, options) {
    try {
      return new Intl.Collator(locales, options);
    } catch {
      return new Intl.Collator(void 0, options);
    }
  },
  Segmenter(locales, options) {
    try {
      return new Intl.Segmenter(locales, options);
    } catch {
      return new Intl.Segmenter(void 0, options);
    }
  },
  Locale(tag, options) {
    try {
      return new Intl.Locale(tag, options);
    } catch {
      return new Intl.Locale(LANGUAGE_DEFAULT, options);
    }
  }
};
export {
  fromNow,
  fromNowByDay,
  getDurationString,
  safeIntl,
  toLocalISOString
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9kYXRlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgTEFOR1VBR0VfREVGQVVMVCB9IGZyb20gJy4vcGxhdGZvcm0uanMnO1xuXG5jb25zdCBtaW51dGUgPSA2MDtcbmNvbnN0IGhvdXIgPSBtaW51dGUgKiA2MDtcbmNvbnN0IGRheSA9IGhvdXIgKiAyNDtcbmNvbnN0IHdlZWsgPSBkYXkgKiA3O1xuY29uc3QgbW9udGggPSBkYXkgKiAzMDtcbmNvbnN0IHllYXIgPSBkYXkgKiAzNjU7XG5cbi8qKlxuICogQ3JlYXRlIGEgbG9jYWxpemVkIGRpZmZlcmVuY2Ugb2YgdGhlIHRpbWUgYmV0d2VlbiBub3cgYW5kIHRoZSBzcGVjaWZpZWQgZGF0ZS5cbiAqIEBwYXJhbSBkYXRlIFRoZSBkYXRlIHRvIGdlbmVyYXRlIHRoZSBkaWZmZXJlbmNlIGZyb20uXG4gKiBAcGFyYW0gYXBwZW5kQWdvTGFiZWwgV2hldGhlciB0byBhcHBlbmQgdGhlIFwiIGFnb1wiIHRvIHRoZSBlbmQuXG4gKiBAcGFyYW0gdXNlRnVsbFRpbWVXb3JkcyBXaGV0aGVyIHRvIHVzZSBmdWxsIHdvcmRzIChlZy4gc2Vjb25kcykgaW5zdGVhZCBvZlxuICogc2hvcnRlbmVkIChlZy4gc2VjcykuXG4gKiBAcGFyYW0gZGlzYWxsb3dOb3cgV2hldGhlciB0byBkaXNhbGxvdyB0aGUgc3RyaW5nIFwibm93XCIgd2hlbiB0aGUgZGlmZmVyZW5jZVxuICogaXMgbGVzcyB0aGFuIDMwIHNlY29uZHMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmcm9tTm93KGRhdGU6IG51bWJlciB8IERhdGUsIGFwcGVuZEFnb0xhYmVsPzogYm9vbGVhbiwgdXNlRnVsbFRpbWVXb3Jkcz86IGJvb2xlYW4sIGRpc2FsbG93Tm93PzogYm9vbGVhbik6IHN0cmluZyB7XG5cdGlmICh0eXBlb2YgZGF0ZSAhPT0gJ251bWJlcicpIHtcblx0XHRkYXRlID0gZGF0ZS5nZXRUaW1lKCk7XG5cdH1cblxuXHRjb25zdCBzZWNvbmRzID0gTWF0aC5yb3VuZCgobmV3IERhdGUoKS5nZXRUaW1lKCkgLSBkYXRlKSAvIDEwMDApO1xuXHRpZiAoc2Vjb25kcyA8IC0zMCkge1xuXHRcdHJldHVybiBsb2NhbGl6ZSgnZGF0ZS5mcm9tTm93LmluJywgJ2luIHswfScsIGZyb21Ob3cobmV3IERhdGUoKS5nZXRUaW1lKCkgKyBzZWNvbmRzICogMTAwMCwgZmFsc2UpKTtcblx0fVxuXG5cdGlmICghZGlzYWxsb3dOb3cgJiYgc2Vjb25kcyA8IDMwKSB7XG5cdFx0cmV0dXJuIGxvY2FsaXplKCdkYXRlLmZyb21Ob3cubm93JywgJ25vdycpO1xuXHR9XG5cblx0bGV0IHZhbHVlOiBudW1iZXI7XG5cdGlmIChzZWNvbmRzIDwgbWludXRlKSB7XG5cdFx0dmFsdWUgPSBzZWNvbmRzO1xuXG5cdFx0aWYgKGFwcGVuZEFnb0xhYmVsKSB7XG5cdFx0XHRpZiAodmFsdWUgPT09IDEpIHtcblx0XHRcdFx0cmV0dXJuIHVzZUZ1bGxUaW1lV29yZHNcblx0XHRcdFx0XHQ/IGxvY2FsaXplKCdkYXRlLmZyb21Ob3cuc2Vjb25kcy5zaW5ndWxhci5hZ28uZnVsbFdvcmQnLCAnezB9IHNlY29uZCBhZ28nLCB2YWx1ZSlcblx0XHRcdFx0XHQ6IGxvY2FsaXplKCdkYXRlLmZyb21Ob3cuc2Vjb25kcy5zaW5ndWxhci5hZ28nLCAnezB9IHNlYyBhZ28nLCB2YWx1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdXNlRnVsbFRpbWVXb3Jkc1xuXHRcdFx0XHRcdD8gbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy5zZWNvbmRzLnBsdXJhbC5hZ28uZnVsbFdvcmQnLCAnezB9IHNlY29uZHMgYWdvJywgdmFsdWUpXG5cdFx0XHRcdFx0OiBsb2NhbGl6ZSgnZGF0ZS5mcm9tTm93LnNlY29uZHMucGx1cmFsLmFnbycsICd7MH0gc2VjcyBhZ28nLCB2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh2YWx1ZSA9PT0gMSkge1xuXHRcdFx0XHRyZXR1cm4gdXNlRnVsbFRpbWVXb3Jkc1xuXHRcdFx0XHRcdD8gbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy5zZWNvbmRzLnNpbmd1bGFyLmZ1bGxXb3JkJywgJ3swfSBzZWNvbmQnLCB2YWx1ZSlcblx0XHRcdFx0XHQ6IGxvY2FsaXplKCdkYXRlLmZyb21Ob3cuc2Vjb25kcy5zaW5ndWxhcicsICd7MH0gc2VjJywgdmFsdWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHVzZUZ1bGxUaW1lV29yZHNcblx0XHRcdFx0XHQ/IGxvY2FsaXplKCdkYXRlLmZyb21Ob3cuc2Vjb25kcy5wbHVyYWwuZnVsbFdvcmQnLCAnezB9IHNlY29uZHMnLCB2YWx1ZSlcblx0XHRcdFx0XHQ6IGxvY2FsaXplKCdkYXRlLmZyb21Ob3cuc2Vjb25kcy5wbHVyYWwnLCAnezB9IHNlY3MnLCB2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aWYgKHNlY29uZHMgPCBob3VyKSB7XG5cdFx0dmFsdWUgPSBNYXRoLmZsb29yKHNlY29uZHMgLyBtaW51dGUpO1xuXHRcdGlmIChhcHBlbmRBZ29MYWJlbCkge1xuXHRcdFx0aWYgKHZhbHVlID09PSAxKSB7XG5cdFx0XHRcdHJldHVybiB1c2VGdWxsVGltZVdvcmRzXG5cdFx0XHRcdFx0PyBsb2NhbGl6ZSgnZGF0ZS5mcm9tTm93Lm1pbnV0ZXMuc2luZ3VsYXIuYWdvLmZ1bGxXb3JkJywgJ3swfSBtaW51dGUgYWdvJywgdmFsdWUpXG5cdFx0XHRcdFx0OiBsb2NhbGl6ZSgnZGF0ZS5mcm9tTm93Lm1pbnV0ZXMuc2luZ3VsYXIuYWdvJywgJ3swfSBtaW4gYWdvJywgdmFsdWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHVzZUZ1bGxUaW1lV29yZHNcblx0XHRcdFx0XHQ/IGxvY2FsaXplKCdkYXRlLmZyb21Ob3cubWludXRlcy5wbHVyYWwuYWdvLmZ1bGxXb3JkJywgJ3swfSBtaW51dGVzIGFnbycsIHZhbHVlKVxuXHRcdFx0XHRcdDogbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy5taW51dGVzLnBsdXJhbC5hZ28nLCAnezB9IG1pbnMgYWdvJywgdmFsdWUpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAodmFsdWUgPT09IDEpIHtcblx0XHRcdFx0cmV0dXJuIHVzZUZ1bGxUaW1lV29yZHNcblx0XHRcdFx0XHQ/IGxvY2FsaXplKCdkYXRlLmZyb21Ob3cubWludXRlcy5zaW5ndWxhci5mdWxsV29yZCcsICd7MH0gbWludXRlJywgdmFsdWUpXG5cdFx0XHRcdFx0OiBsb2NhbGl6ZSgnZGF0ZS5mcm9tTm93Lm1pbnV0ZXMuc2luZ3VsYXInLCAnezB9IG1pbicsIHZhbHVlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiB1c2VGdWxsVGltZVdvcmRzXG5cdFx0XHRcdFx0PyBsb2NhbGl6ZSgnZGF0ZS5mcm9tTm93Lm1pbnV0ZXMucGx1cmFsLmZ1bGxXb3JkJywgJ3swfSBtaW51dGVzJywgdmFsdWUpXG5cdFx0XHRcdFx0OiBsb2NhbGl6ZSgnZGF0ZS5mcm9tTm93Lm1pbnV0ZXMucGx1cmFsJywgJ3swfSBtaW5zJywgdmFsdWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGlmIChzZWNvbmRzIDwgZGF5KSB7XG5cdFx0dmFsdWUgPSBNYXRoLmZsb29yKHNlY29uZHMgLyBob3VyKTtcblx0XHRpZiAoYXBwZW5kQWdvTGFiZWwpIHtcblx0XHRcdGlmICh2YWx1ZSA9PT0gMSkge1xuXHRcdFx0XHRyZXR1cm4gdXNlRnVsbFRpbWVXb3Jkc1xuXHRcdFx0XHRcdD8gbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy5ob3Vycy5zaW5ndWxhci5hZ28uZnVsbFdvcmQnLCAnezB9IGhvdXIgYWdvJywgdmFsdWUpXG5cdFx0XHRcdFx0OiBsb2NhbGl6ZSgnZGF0ZS5mcm9tTm93LmhvdXJzLnNpbmd1bGFyLmFnbycsICd7MH0gaHIgYWdvJywgdmFsdWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHVzZUZ1bGxUaW1lV29yZHNcblx0XHRcdFx0XHQ/IGxvY2FsaXplKCdkYXRlLmZyb21Ob3cuaG91cnMucGx1cmFsLmFnby5mdWxsV29yZCcsICd7MH0gaG91cnMgYWdvJywgdmFsdWUpXG5cdFx0XHRcdFx0OiBsb2NhbGl6ZSgnZGF0ZS5mcm9tTm93LmhvdXJzLnBsdXJhbC5hZ28nLCAnezB9IGhycyBhZ28nLCB2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh2YWx1ZSA9PT0gMSkge1xuXHRcdFx0XHRyZXR1cm4gdXNlRnVsbFRpbWVXb3Jkc1xuXHRcdFx0XHRcdD8gbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy5ob3Vycy5zaW5ndWxhci5mdWxsV29yZCcsICd7MH0gaG91cicsIHZhbHVlKVxuXHRcdFx0XHRcdDogbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy5ob3Vycy5zaW5ndWxhcicsICd7MH0gaHInLCB2YWx1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdXNlRnVsbFRpbWVXb3Jkc1xuXHRcdFx0XHRcdD8gbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy5ob3Vycy5wbHVyYWwuZnVsbFdvcmQnLCAnezB9IGhvdXJzJywgdmFsdWUpXG5cdFx0XHRcdFx0OiBsb2NhbGl6ZSgnZGF0ZS5mcm9tTm93LmhvdXJzLnBsdXJhbCcsICd7MH0gaHJzJywgdmFsdWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGlmIChzZWNvbmRzIDwgd2Vlaykge1xuXHRcdHZhbHVlID0gTWF0aC5mbG9vcihzZWNvbmRzIC8gZGF5KTtcblx0XHRpZiAoYXBwZW5kQWdvTGFiZWwpIHtcblx0XHRcdHJldHVybiB2YWx1ZSA9PT0gMVxuXHRcdFx0XHQ/IGxvY2FsaXplKCdkYXRlLmZyb21Ob3cuZGF5cy5zaW5ndWxhci5hZ28nLCAnezB9IGRheSBhZ28nLCB2YWx1ZSlcblx0XHRcdFx0OiBsb2NhbGl6ZSgnZGF0ZS5mcm9tTm93LmRheXMucGx1cmFsLmFnbycsICd7MH0gZGF5cyBhZ28nLCB2YWx1ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB2YWx1ZSA9PT0gMVxuXHRcdFx0XHQ/IGxvY2FsaXplKCdkYXRlLmZyb21Ob3cuZGF5cy5zaW5ndWxhcicsICd7MH0gZGF5JywgdmFsdWUpXG5cdFx0XHRcdDogbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy5kYXlzLnBsdXJhbCcsICd7MH0gZGF5cycsIHZhbHVlKTtcblx0XHR9XG5cdH1cblxuXHRpZiAoc2Vjb25kcyA8IG1vbnRoKSB7XG5cdFx0dmFsdWUgPSBNYXRoLmZsb29yKHNlY29uZHMgLyB3ZWVrKTtcblx0XHRpZiAoYXBwZW5kQWdvTGFiZWwpIHtcblx0XHRcdGlmICh2YWx1ZSA9PT0gMSkge1xuXHRcdFx0XHRyZXR1cm4gdXNlRnVsbFRpbWVXb3Jkc1xuXHRcdFx0XHRcdD8gbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy53ZWVrcy5zaW5ndWxhci5hZ28uZnVsbFdvcmQnLCAnezB9IHdlZWsgYWdvJywgdmFsdWUpXG5cdFx0XHRcdFx0OiBsb2NhbGl6ZSgnZGF0ZS5mcm9tTm93LndlZWtzLnNpbmd1bGFyLmFnbycsICd7MH0gd2sgYWdvJywgdmFsdWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHVzZUZ1bGxUaW1lV29yZHNcblx0XHRcdFx0XHQ/IGxvY2FsaXplKCdkYXRlLmZyb21Ob3cud2Vla3MucGx1cmFsLmFnby5mdWxsV29yZCcsICd7MH0gd2Vla3MgYWdvJywgdmFsdWUpXG5cdFx0XHRcdFx0OiBsb2NhbGl6ZSgnZGF0ZS5mcm9tTm93LndlZWtzLnBsdXJhbC5hZ28nLCAnezB9IHdrcyBhZ28nLCB2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh2YWx1ZSA9PT0gMSkge1xuXHRcdFx0XHRyZXR1cm4gdXNlRnVsbFRpbWVXb3Jkc1xuXHRcdFx0XHRcdD8gbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy53ZWVrcy5zaW5ndWxhci5mdWxsV29yZCcsICd7MH0gd2VlaycsIHZhbHVlKVxuXHRcdFx0XHRcdDogbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy53ZWVrcy5zaW5ndWxhcicsICd7MH0gd2snLCB2YWx1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdXNlRnVsbFRpbWVXb3Jkc1xuXHRcdFx0XHRcdD8gbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy53ZWVrcy5wbHVyYWwuZnVsbFdvcmQnLCAnezB9IHdlZWtzJywgdmFsdWUpXG5cdFx0XHRcdFx0OiBsb2NhbGl6ZSgnZGF0ZS5mcm9tTm93LndlZWtzLnBsdXJhbCcsICd7MH0gd2tzJywgdmFsdWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGlmIChzZWNvbmRzIDwgeWVhcikge1xuXHRcdHZhbHVlID0gTWF0aC5mbG9vcihzZWNvbmRzIC8gbW9udGgpO1xuXHRcdGlmIChhcHBlbmRBZ29MYWJlbCkge1xuXHRcdFx0aWYgKHZhbHVlID09PSAxKSB7XG5cdFx0XHRcdHJldHVybiB1c2VGdWxsVGltZVdvcmRzXG5cdFx0XHRcdFx0PyBsb2NhbGl6ZSgnZGF0ZS5mcm9tTm93Lm1vbnRocy5zaW5ndWxhci5hZ28uZnVsbFdvcmQnLCAnezB9IG1vbnRoIGFnbycsIHZhbHVlKVxuXHRcdFx0XHRcdDogbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy5tb250aHMuc2luZ3VsYXIuYWdvJywgJ3swfSBtbyBhZ28nLCB2YWx1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdXNlRnVsbFRpbWVXb3Jkc1xuXHRcdFx0XHRcdD8gbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy5tb250aHMucGx1cmFsLmFnby5mdWxsV29yZCcsICd7MH0gbW9udGhzIGFnbycsIHZhbHVlKVxuXHRcdFx0XHRcdDogbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy5tb250aHMucGx1cmFsLmFnbycsICd7MH0gbW9zIGFnbycsIHZhbHVlKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKHZhbHVlID09PSAxKSB7XG5cdFx0XHRcdHJldHVybiB1c2VGdWxsVGltZVdvcmRzXG5cdFx0XHRcdFx0PyBsb2NhbGl6ZSgnZGF0ZS5mcm9tTm93Lm1vbnRocy5zaW5ndWxhci5mdWxsV29yZCcsICd7MH0gbW9udGgnLCB2YWx1ZSlcblx0XHRcdFx0XHQ6IGxvY2FsaXplKCdkYXRlLmZyb21Ob3cubW9udGhzLnNpbmd1bGFyJywgJ3swfSBtbycsIHZhbHVlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiB1c2VGdWxsVGltZVdvcmRzXG5cdFx0XHRcdFx0PyBsb2NhbGl6ZSgnZGF0ZS5mcm9tTm93Lm1vbnRocy5wbHVyYWwuZnVsbFdvcmQnLCAnezB9IG1vbnRocycsIHZhbHVlKVxuXHRcdFx0XHRcdDogbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy5tb250aHMucGx1cmFsJywgJ3swfSBtb3MnLCB2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0dmFsdWUgPSBNYXRoLmZsb29yKHNlY29uZHMgLyB5ZWFyKTtcblx0aWYgKGFwcGVuZEFnb0xhYmVsKSB7XG5cdFx0aWYgKHZhbHVlID09PSAxKSB7XG5cdFx0XHRyZXR1cm4gdXNlRnVsbFRpbWVXb3Jkc1xuXHRcdFx0XHQ/IGxvY2FsaXplKCdkYXRlLmZyb21Ob3cueWVhcnMuc2luZ3VsYXIuYWdvLmZ1bGxXb3JkJywgJ3swfSB5ZWFyIGFnbycsIHZhbHVlKVxuXHRcdFx0XHQ6IGxvY2FsaXplKCdkYXRlLmZyb21Ob3cueWVhcnMuc2luZ3VsYXIuYWdvJywgJ3swfSB5ciBhZ28nLCB2YWx1ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB1c2VGdWxsVGltZVdvcmRzXG5cdFx0XHRcdD8gbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy55ZWFycy5wbHVyYWwuYWdvLmZ1bGxXb3JkJywgJ3swfSB5ZWFycyBhZ28nLCB2YWx1ZSlcblx0XHRcdFx0OiBsb2NhbGl6ZSgnZGF0ZS5mcm9tTm93LnllYXJzLnBsdXJhbC5hZ28nLCAnezB9IHlycyBhZ28nLCB2YWx1ZSk7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdGlmICh2YWx1ZSA9PT0gMSkge1xuXHRcdFx0cmV0dXJuIHVzZUZ1bGxUaW1lV29yZHNcblx0XHRcdFx0PyBsb2NhbGl6ZSgnZGF0ZS5mcm9tTm93LnllYXJzLnNpbmd1bGFyLmZ1bGxXb3JkJywgJ3swfSB5ZWFyJywgdmFsdWUpXG5cdFx0XHRcdDogbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy55ZWFycy5zaW5ndWxhcicsICd7MH0geXInLCB2YWx1ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB1c2VGdWxsVGltZVdvcmRzXG5cdFx0XHRcdD8gbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy55ZWFycy5wbHVyYWwuZnVsbFdvcmQnLCAnezB9IHllYXJzJywgdmFsdWUpXG5cdFx0XHRcdDogbG9jYWxpemUoJ2RhdGUuZnJvbU5vdy55ZWFycy5wbHVyYWwnLCAnezB9IHlycycsIHZhbHVlKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZyb21Ob3dCeURheShkYXRlOiBudW1iZXIgfCBEYXRlLCBhcHBlbmRBZ29MYWJlbD86IGJvb2xlYW4sIHVzZUZ1bGxUaW1lV29yZHM/OiBib29sZWFuKTogc3RyaW5nIHtcblx0aWYgKHR5cGVvZiBkYXRlICE9PSAnbnVtYmVyJykge1xuXHRcdGRhdGUgPSBkYXRlLmdldFRpbWUoKTtcblx0fVxuXG5cdGNvbnN0IHRvZGF5TWlkbmlnaHRUaW1lID0gbmV3IERhdGUoKTtcblx0dG9kYXlNaWRuaWdodFRpbWUuc2V0SG91cnMoMCwgMCwgMCwgMCk7XG5cdGNvbnN0IHllc3RlcmRheU1pZG5pZ2h0VGltZSA9IG5ldyBEYXRlKHRvZGF5TWlkbmlnaHRUaW1lLmdldFRpbWUoKSk7XG5cdHllc3RlcmRheU1pZG5pZ2h0VGltZS5zZXREYXRlKHllc3RlcmRheU1pZG5pZ2h0VGltZS5nZXREYXRlKCkgLSAxKTtcblxuXHRpZiAoZGF0ZSA+IHRvZGF5TWlkbmlnaHRUaW1lLmdldFRpbWUoKSkge1xuXHRcdHJldHVybiBsb2NhbGl6ZSgndG9kYXknLCAnVG9kYXknKTtcblx0fVxuXG5cdGlmIChkYXRlID4geWVzdGVyZGF5TWlkbmlnaHRUaW1lLmdldFRpbWUoKSkge1xuXHRcdHJldHVybiBsb2NhbGl6ZSgneWVzdGVyZGF5JywgJ1llc3RlcmRheScpO1xuXHR9XG5cblx0cmV0dXJuIGZyb21Ob3coZGF0ZSwgYXBwZW5kQWdvTGFiZWwsIHVzZUZ1bGxUaW1lV29yZHMpO1xufVxuXG4vKipcbiAqIEdldHMgYSByZWFkYWJsZSBkdXJhdGlvbiB3aXRoIGludGVsbGlnZW50L2xvc3N5IHByZWNpc2lvbi4gRm9yIGV4YW1wbGUgXCI0MG1zXCIgb3IgXCIzLjA0MHNcIilcbiAqIEBwYXJhbSBtcyBUaGUgZHVyYXRpb24gdG8gZ2V0IGluIG1pbGxpc2Vjb25kcy5cbiAqIEBwYXJhbSB1c2VGdWxsVGltZVdvcmRzIFdoZXRoZXIgdG8gdXNlIGZ1bGwgd29yZHMgKGVnLiBzZWNvbmRzKSBpbnN0ZWFkIG9mXG4gKiBzaG9ydGVuZWQgKGVnLiBzZWNzKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldER1cmF0aW9uU3RyaW5nKG1zOiBudW1iZXIsIHVzZUZ1bGxUaW1lV29yZHM/OiBib29sZWFuKSB7XG5cdGNvbnN0IHNlY29uZHMgPSBNYXRoLmFicyhtcyAvIDEwMDApO1xuXHRpZiAoc2Vjb25kcyA8IDEpIHtcblx0XHRyZXR1cm4gdXNlRnVsbFRpbWVXb3Jkc1xuXHRcdFx0PyBsb2NhbGl6ZSgnZHVyYXRpb24ubXMuZnVsbCcsICd7MH0gbWlsbGlzZWNvbmRzJywgbXMpXG5cdFx0XHQ6IGxvY2FsaXplKCdkdXJhdGlvbi5tcycsICd7MH1tcycsIG1zKTtcblx0fVxuXHRpZiAoc2Vjb25kcyA8IG1pbnV0ZSkge1xuXHRcdHJldHVybiB1c2VGdWxsVGltZVdvcmRzXG5cdFx0XHQ/IGxvY2FsaXplKCdkdXJhdGlvbi5zLmZ1bGwnLCAnezB9IHNlY29uZHMnLCBNYXRoLnJvdW5kKG1zKSAvIDEwMDApXG5cdFx0XHQ6IGxvY2FsaXplKCdkdXJhdGlvbi5zJywgJ3swfXMnLCBNYXRoLnJvdW5kKG1zKSAvIDEwMDApO1xuXHR9XG5cdGlmIChzZWNvbmRzIDwgaG91cikge1xuXHRcdHJldHVybiB1c2VGdWxsVGltZVdvcmRzXG5cdFx0XHQ/IGxvY2FsaXplKCdkdXJhdGlvbi5tLmZ1bGwnLCAnezB9IG1pbnV0ZXMnLCBNYXRoLnJvdW5kKG1zIC8gKDEwMDAgKiBtaW51dGUpKSlcblx0XHRcdDogbG9jYWxpemUoJ2R1cmF0aW9uLm0nLCAnezB9IG1pbnMnLCBNYXRoLnJvdW5kKG1zIC8gKDEwMDAgKiBtaW51dGUpKSk7XG5cdH1cblx0aWYgKHNlY29uZHMgPCBkYXkpIHtcblx0XHRyZXR1cm4gdXNlRnVsbFRpbWVXb3Jkc1xuXHRcdFx0PyBsb2NhbGl6ZSgnZHVyYXRpb24uaC5mdWxsJywgJ3swfSBob3VycycsIE1hdGgucm91bmQobXMgLyAoMTAwMCAqIGhvdXIpKSlcblx0XHRcdDogbG9jYWxpemUoJ2R1cmF0aW9uLmgnLCAnezB9IGhycycsIE1hdGgucm91bmQobXMgLyAoMTAwMCAqIGhvdXIpKSk7XG5cdH1cblx0cmV0dXJuIGxvY2FsaXplKCdkdXJhdGlvbi5kJywgJ3swfSBkYXlzJywgTWF0aC5yb3VuZChtcyAvICgxMDAwICogZGF5KSkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9Mb2NhbElTT1N0cmluZyhkYXRlOiBEYXRlKTogc3RyaW5nIHtcblx0cmV0dXJuIGRhdGUuZ2V0RnVsbFllYXIoKSArXG5cdFx0Jy0nICsgU3RyaW5nKGRhdGUuZ2V0TW9udGgoKSArIDEpLnBhZFN0YXJ0KDIsICcwJykgK1xuXHRcdCctJyArIFN0cmluZyhkYXRlLmdldERhdGUoKSkucGFkU3RhcnQoMiwgJzAnKSArXG5cdFx0J1QnICsgU3RyaW5nKGRhdGUuZ2V0SG91cnMoKSkucGFkU3RhcnQoMiwgJzAnKSArXG5cdFx0JzonICsgU3RyaW5nKGRhdGUuZ2V0TWludXRlcygpKS5wYWRTdGFydCgyLCAnMCcpICtcblx0XHQnOicgKyBTdHJpbmcoZGF0ZS5nZXRTZWNvbmRzKCkpLnBhZFN0YXJ0KDIsICcwJykgK1xuXHRcdCcuJyArIChkYXRlLmdldE1pbGxpc2Vjb25kcygpIC8gMTAwMCkudG9GaXhlZCgzKS5zbGljZSgyLCA1KSArXG5cdFx0J1onO1xufVxuXG5leHBvcnQgY29uc3Qgc2FmZUludGwgPSB7XG5cdERhdGVUaW1lRm9ybWF0KGxvY2FsZXM/OiBJbnRsLkxvY2FsZXNBcmd1bWVudCwgb3B0aW9ucz86IEludGwuRGF0ZVRpbWVGb3JtYXRPcHRpb25zKTogSW50bC5EYXRlVGltZUZvcm1hdCB7XG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBuZXcgSW50bC5EYXRlVGltZUZvcm1hdChsb2NhbGVzLCBvcHRpb25zKTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdHJldHVybiBuZXcgSW50bC5EYXRlVGltZUZvcm1hdCh1bmRlZmluZWQsIG9wdGlvbnMpO1xuXHRcdH1cblx0fSxcblx0Q29sbGF0b3IobG9jYWxlcz86IEludGwuTG9jYWxlc0FyZ3VtZW50LCBvcHRpb25zPzogSW50bC5Db2xsYXRvck9wdGlvbnMpOiBJbnRsLkNvbGxhdG9yIHtcblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIG5ldyBJbnRsLkNvbGxhdG9yKGxvY2FsZXMsIG9wdGlvbnMpO1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0cmV0dXJuIG5ldyBJbnRsLkNvbGxhdG9yKHVuZGVmaW5lZCwgb3B0aW9ucyk7XG5cdFx0fVxuXHR9LFxuXHRTZWdtZW50ZXIobG9jYWxlcz86IEludGwuTG9jYWxlc0FyZ3VtZW50LCBvcHRpb25zPzogSW50bC5TZWdtZW50ZXJPcHRpb25zKTogSW50bC5TZWdtZW50ZXIge1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gbmV3IEludGwuU2VnbWVudGVyKGxvY2FsZXMsIG9wdGlvbnMpO1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0cmV0dXJuIG5ldyBJbnRsLlNlZ21lbnRlcih1bmRlZmluZWQsIG9wdGlvbnMpO1xuXHRcdH1cblx0fSxcblx0TG9jYWxlKHRhZzogSW50bC5Mb2NhbGUgfCBzdHJpbmcsIG9wdGlvbnM/OiBJbnRsLkxvY2FsZU9wdGlvbnMpOiBJbnRsLkxvY2FsZSB7XG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBuZXcgSW50bC5Mb2NhbGUodGFnLCBvcHRpb25zKTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdHJldHVybiBuZXcgSW50bC5Mb2NhbGUoTEFOR1VBR0VfREVGQVVMVCwgb3B0aW9ucyk7XG5cdFx0fVxuXHR9XG59O1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx3QkFBd0I7QUFFakMsTUFBTSxTQUFTO0FBQ2YsTUFBTSxPQUFPLFNBQVM7QUFDdEIsTUFBTSxNQUFNLE9BQU87QUFDbkIsTUFBTSxPQUFPLE1BQU07QUFDbkIsTUFBTSxRQUFRLE1BQU07QUFDcEIsTUFBTSxPQUFPLE1BQU07QUFXWixTQUFTLFFBQVEsTUFBcUIsZ0JBQTBCLGtCQUE0QixhQUErQjtBQUNqSSxNQUFJLE9BQU8sU0FBUyxVQUFVO0FBQzdCLFdBQU8sS0FBSyxRQUFRO0FBQUEsRUFDckI7QUFFQSxRQUFNLFVBQVUsS0FBSyxRQUFPLG9CQUFJLEtBQUssR0FBRSxRQUFRLElBQUksUUFBUSxHQUFJO0FBQy9ELE1BQUksVUFBVSxLQUFLO0FBQ2xCLFdBQU8sU0FBUyxtQkFBbUIsVUFBVSxTQUFRLG9CQUFJLEtBQUssR0FBRSxRQUFRLElBQUksVUFBVSxLQUFNLEtBQUssQ0FBQztBQUFBLEVBQ25HO0FBRUEsTUFBSSxDQUFDLGVBQWUsVUFBVSxJQUFJO0FBQ2pDLFdBQU8sU0FBUyxvQkFBb0IsS0FBSztBQUFBLEVBQzFDO0FBRUEsTUFBSTtBQUNKLE1BQUksVUFBVSxRQUFRO0FBQ3JCLFlBQVE7QUFFUixRQUFJLGdCQUFnQjtBQUNuQixVQUFJLFVBQVUsR0FBRztBQUNoQixlQUFPLG1CQUNKLFNBQVMsOENBQThDLGtCQUFrQixLQUFLLElBQzlFLFNBQVMscUNBQXFDLGVBQWUsS0FBSztBQUFBLE1BQ3RFLE9BQU87QUFDTixlQUFPLG1CQUNKLFNBQVMsNENBQTRDLG1CQUFtQixLQUFLLElBQzdFLFNBQVMsbUNBQW1DLGdCQUFnQixLQUFLO0FBQUEsTUFDckU7QUFBQSxJQUNELE9BQU87QUFDTixVQUFJLFVBQVUsR0FBRztBQUNoQixlQUFPLG1CQUNKLFNBQVMsMENBQTBDLGNBQWMsS0FBSyxJQUN0RSxTQUFTLGlDQUFpQyxXQUFXLEtBQUs7QUFBQSxNQUM5RCxPQUFPO0FBQ04sZUFBTyxtQkFDSixTQUFTLHdDQUF3QyxlQUFlLEtBQUssSUFDckUsU0FBUywrQkFBK0IsWUFBWSxLQUFLO0FBQUEsTUFDN0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVBLE1BQUksVUFBVSxNQUFNO0FBQ25CLFlBQVEsS0FBSyxNQUFNLFVBQVUsTUFBTTtBQUNuQyxRQUFJLGdCQUFnQjtBQUNuQixVQUFJLFVBQVUsR0FBRztBQUNoQixlQUFPLG1CQUNKLFNBQVMsOENBQThDLGtCQUFrQixLQUFLLElBQzlFLFNBQVMscUNBQXFDLGVBQWUsS0FBSztBQUFBLE1BQ3RFLE9BQU87QUFDTixlQUFPLG1CQUNKLFNBQVMsNENBQTRDLG1CQUFtQixLQUFLLElBQzdFLFNBQVMsbUNBQW1DLGdCQUFnQixLQUFLO0FBQUEsTUFDckU7QUFBQSxJQUNELE9BQU87QUFDTixVQUFJLFVBQVUsR0FBRztBQUNoQixlQUFPLG1CQUNKLFNBQVMsMENBQTBDLGNBQWMsS0FBSyxJQUN0RSxTQUFTLGlDQUFpQyxXQUFXLEtBQUs7QUFBQSxNQUM5RCxPQUFPO0FBQ04sZUFBTyxtQkFDSixTQUFTLHdDQUF3QyxlQUFlLEtBQUssSUFDckUsU0FBUywrQkFBK0IsWUFBWSxLQUFLO0FBQUEsTUFDN0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVBLE1BQUksVUFBVSxLQUFLO0FBQ2xCLFlBQVEsS0FBSyxNQUFNLFVBQVUsSUFBSTtBQUNqQyxRQUFJLGdCQUFnQjtBQUNuQixVQUFJLFVBQVUsR0FBRztBQUNoQixlQUFPLG1CQUNKLFNBQVMsNENBQTRDLGdCQUFnQixLQUFLLElBQzFFLFNBQVMsbUNBQW1DLGNBQWMsS0FBSztBQUFBLE1BQ25FLE9BQU87QUFDTixlQUFPLG1CQUNKLFNBQVMsMENBQTBDLGlCQUFpQixLQUFLLElBQ3pFLFNBQVMsaUNBQWlDLGVBQWUsS0FBSztBQUFBLE1BQ2xFO0FBQUEsSUFDRCxPQUFPO0FBQ04sVUFBSSxVQUFVLEdBQUc7QUFDaEIsZUFBTyxtQkFDSixTQUFTLHdDQUF3QyxZQUFZLEtBQUssSUFDbEUsU0FBUywrQkFBK0IsVUFBVSxLQUFLO0FBQUEsTUFDM0QsT0FBTztBQUNOLGVBQU8sbUJBQ0osU0FBUyxzQ0FBc0MsYUFBYSxLQUFLLElBQ2pFLFNBQVMsNkJBQTZCLFdBQVcsS0FBSztBQUFBLE1BQzFEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFFQSxNQUFJLFVBQVUsTUFBTTtBQUNuQixZQUFRLEtBQUssTUFBTSxVQUFVLEdBQUc7QUFDaEMsUUFBSSxnQkFBZ0I7QUFDbkIsYUFBTyxVQUFVLElBQ2QsU0FBUyxrQ0FBa0MsZUFBZSxLQUFLLElBQy9ELFNBQVMsZ0NBQWdDLGdCQUFnQixLQUFLO0FBQUEsSUFDbEUsT0FBTztBQUNOLGFBQU8sVUFBVSxJQUNkLFNBQVMsOEJBQThCLFdBQVcsS0FBSyxJQUN2RCxTQUFTLDRCQUE0QixZQUFZLEtBQUs7QUFBQSxJQUMxRDtBQUFBLEVBQ0Q7QUFFQSxNQUFJLFVBQVUsT0FBTztBQUNwQixZQUFRLEtBQUssTUFBTSxVQUFVLElBQUk7QUFDakMsUUFBSSxnQkFBZ0I7QUFDbkIsVUFBSSxVQUFVLEdBQUc7QUFDaEIsZUFBTyxtQkFDSixTQUFTLDRDQUE0QyxnQkFBZ0IsS0FBSyxJQUMxRSxTQUFTLG1DQUFtQyxjQUFjLEtBQUs7QUFBQSxNQUNuRSxPQUFPO0FBQ04sZUFBTyxtQkFDSixTQUFTLDBDQUEwQyxpQkFBaUIsS0FBSyxJQUN6RSxTQUFTLGlDQUFpQyxlQUFlLEtBQUs7QUFBQSxNQUNsRTtBQUFBLElBQ0QsT0FBTztBQUNOLFVBQUksVUFBVSxHQUFHO0FBQ2hCLGVBQU8sbUJBQ0osU0FBUyx3Q0FBd0MsWUFBWSxLQUFLLElBQ2xFLFNBQVMsK0JBQStCLFVBQVUsS0FBSztBQUFBLE1BQzNELE9BQU87QUFDTixlQUFPLG1CQUNKLFNBQVMsc0NBQXNDLGFBQWEsS0FBSyxJQUNqRSxTQUFTLDZCQUE2QixXQUFXLEtBQUs7QUFBQSxNQUMxRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBRUEsTUFBSSxVQUFVLE1BQU07QUFDbkIsWUFBUSxLQUFLLE1BQU0sVUFBVSxLQUFLO0FBQ2xDLFFBQUksZ0JBQWdCO0FBQ25CLFVBQUksVUFBVSxHQUFHO0FBQ2hCLGVBQU8sbUJBQ0osU0FBUyw2Q0FBNkMsaUJBQWlCLEtBQUssSUFDNUUsU0FBUyxvQ0FBb0MsY0FBYyxLQUFLO0FBQUEsTUFDcEUsT0FBTztBQUNOLGVBQU8sbUJBQ0osU0FBUywyQ0FBMkMsa0JBQWtCLEtBQUssSUFDM0UsU0FBUyxrQ0FBa0MsZUFBZSxLQUFLO0FBQUEsTUFDbkU7QUFBQSxJQUNELE9BQU87QUFDTixVQUFJLFVBQVUsR0FBRztBQUNoQixlQUFPLG1CQUNKLFNBQVMseUNBQXlDLGFBQWEsS0FBSyxJQUNwRSxTQUFTLGdDQUFnQyxVQUFVLEtBQUs7QUFBQSxNQUM1RCxPQUFPO0FBQ04sZUFBTyxtQkFDSixTQUFTLHVDQUF1QyxjQUFjLEtBQUssSUFDbkUsU0FBUyw4QkFBOEIsV0FBVyxLQUFLO0FBQUEsTUFDM0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVBLFVBQVEsS0FBSyxNQUFNLFVBQVUsSUFBSTtBQUNqQyxNQUFJLGdCQUFnQjtBQUNuQixRQUFJLFVBQVUsR0FBRztBQUNoQixhQUFPLG1CQUNKLFNBQVMsNENBQTRDLGdCQUFnQixLQUFLLElBQzFFLFNBQVMsbUNBQW1DLGNBQWMsS0FBSztBQUFBLElBQ25FLE9BQU87QUFDTixhQUFPLG1CQUNKLFNBQVMsMENBQTBDLGlCQUFpQixLQUFLLElBQ3pFLFNBQVMsaUNBQWlDLGVBQWUsS0FBSztBQUFBLElBQ2xFO0FBQUEsRUFDRCxPQUFPO0FBQ04sUUFBSSxVQUFVLEdBQUc7QUFDaEIsYUFBTyxtQkFDSixTQUFTLHdDQUF3QyxZQUFZLEtBQUssSUFDbEUsU0FBUywrQkFBK0IsVUFBVSxLQUFLO0FBQUEsSUFDM0QsT0FBTztBQUNOLGFBQU8sbUJBQ0osU0FBUyxzQ0FBc0MsYUFBYSxLQUFLLElBQ2pFLFNBQVMsNkJBQTZCLFdBQVcsS0FBSztBQUFBLElBQzFEO0FBQUEsRUFDRDtBQUNEO0FBRU8sU0FBUyxhQUFhLE1BQXFCLGdCQUEwQixrQkFBb0M7QUFDL0csTUFBSSxPQUFPLFNBQVMsVUFBVTtBQUM3QixXQUFPLEtBQUssUUFBUTtBQUFBLEVBQ3JCO0FBRUEsUUFBTSxvQkFBb0Isb0JBQUksS0FBSztBQUNuQyxvQkFBa0IsU0FBUyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQ3JDLFFBQU0sd0JBQXdCLElBQUksS0FBSyxrQkFBa0IsUUFBUSxDQUFDO0FBQ2xFLHdCQUFzQixRQUFRLHNCQUFzQixRQUFRLElBQUksQ0FBQztBQUVqRSxNQUFJLE9BQU8sa0JBQWtCLFFBQVEsR0FBRztBQUN2QyxXQUFPLFNBQVMsU0FBUyxPQUFPO0FBQUEsRUFDakM7QUFFQSxNQUFJLE9BQU8sc0JBQXNCLFFBQVEsR0FBRztBQUMzQyxXQUFPLFNBQVMsYUFBYSxXQUFXO0FBQUEsRUFDekM7QUFFQSxTQUFPLFFBQVEsTUFBTSxnQkFBZ0IsZ0JBQWdCO0FBQ3REO0FBUU8sU0FBUyxrQkFBa0IsSUFBWSxrQkFBNEI7QUFDekUsUUFBTSxVQUFVLEtBQUssSUFBSSxLQUFLLEdBQUk7QUFDbEMsTUFBSSxVQUFVLEdBQUc7QUFDaEIsV0FBTyxtQkFDSixTQUFTLG9CQUFvQixvQkFBb0IsRUFBRSxJQUNuRCxTQUFTLGVBQWUsU0FBUyxFQUFFO0FBQUEsRUFDdkM7QUFDQSxNQUFJLFVBQVUsUUFBUTtBQUNyQixXQUFPLG1CQUNKLFNBQVMsbUJBQW1CLGVBQWUsS0FBSyxNQUFNLEVBQUUsSUFBSSxHQUFJLElBQ2hFLFNBQVMsY0FBYyxRQUFRLEtBQUssTUFBTSxFQUFFLElBQUksR0FBSTtBQUFBLEVBQ3hEO0FBQ0EsTUFBSSxVQUFVLE1BQU07QUFDbkIsV0FBTyxtQkFDSixTQUFTLG1CQUFtQixlQUFlLEtBQUssTUFBTSxNQUFNLE1BQU8sT0FBTyxDQUFDLElBQzNFLFNBQVMsY0FBYyxZQUFZLEtBQUssTUFBTSxNQUFNLE1BQU8sT0FBTyxDQUFDO0FBQUEsRUFDdkU7QUFDQSxNQUFJLFVBQVUsS0FBSztBQUNsQixXQUFPLG1CQUNKLFNBQVMsbUJBQW1CLGFBQWEsS0FBSyxNQUFNLE1BQU0sTUFBTyxLQUFLLENBQUMsSUFDdkUsU0FBUyxjQUFjLFdBQVcsS0FBSyxNQUFNLE1BQU0sTUFBTyxLQUFLLENBQUM7QUFBQSxFQUNwRTtBQUNBLFNBQU8sU0FBUyxjQUFjLFlBQVksS0FBSyxNQUFNLE1BQU0sTUFBTyxJQUFJLENBQUM7QUFDeEU7QUFFTyxTQUFTLGlCQUFpQixNQUFvQjtBQUNwRCxTQUFPLEtBQUssWUFBWSxJQUN2QixNQUFNLE9BQU8sS0FBSyxTQUFTLElBQUksQ0FBQyxFQUFFLFNBQVMsR0FBRyxHQUFHLElBQ2pELE1BQU0sT0FBTyxLQUFLLFFBQVEsQ0FBQyxFQUFFLFNBQVMsR0FBRyxHQUFHLElBQzVDLE1BQU0sT0FBTyxLQUFLLFNBQVMsQ0FBQyxFQUFFLFNBQVMsR0FBRyxHQUFHLElBQzdDLE1BQU0sT0FBTyxLQUFLLFdBQVcsQ0FBQyxFQUFFLFNBQVMsR0FBRyxHQUFHLElBQy9DLE1BQU0sT0FBTyxLQUFLLFdBQVcsQ0FBQyxFQUFFLFNBQVMsR0FBRyxHQUFHLElBQy9DLE9BQU8sS0FBSyxnQkFBZ0IsSUFBSSxLQUFNLFFBQVEsQ0FBQyxFQUFFLE1BQU0sR0FBRyxDQUFDLElBQzNEO0FBQ0Y7QUFFTyxNQUFNLFdBQVc7QUFBQSxFQUN2QixlQUFlLFNBQWdDLFNBQTJEO0FBQ3pHLFFBQUk7QUFDSCxhQUFPLElBQUksS0FBSyxlQUFlLFNBQVMsT0FBTztBQUFBLElBQ2hELFFBQVE7QUFDUCxhQUFPLElBQUksS0FBSyxlQUFlLFFBQVcsT0FBTztBQUFBLElBQ2xEO0FBQUEsRUFDRDtBQUFBLEVBQ0EsU0FBUyxTQUFnQyxTQUErQztBQUN2RixRQUFJO0FBQ0gsYUFBTyxJQUFJLEtBQUssU0FBUyxTQUFTLE9BQU87QUFBQSxJQUMxQyxRQUFRO0FBQ1AsYUFBTyxJQUFJLEtBQUssU0FBUyxRQUFXLE9BQU87QUFBQSxJQUM1QztBQUFBLEVBQ0Q7QUFBQSxFQUNBLFVBQVUsU0FBZ0MsU0FBaUQ7QUFDMUYsUUFBSTtBQUNILGFBQU8sSUFBSSxLQUFLLFVBQVUsU0FBUyxPQUFPO0FBQUEsSUFDM0MsUUFBUTtBQUNQLGFBQU8sSUFBSSxLQUFLLFVBQVUsUUFBVyxPQUFPO0FBQUEsSUFDN0M7QUFBQSxFQUNEO0FBQUEsRUFDQSxPQUFPLEtBQTJCLFNBQTJDO0FBQzVFLFFBQUk7QUFDSCxhQUFPLElBQUksS0FBSyxPQUFPLEtBQUssT0FBTztBQUFBLElBQ3BDLFFBQVE7QUFDUCxhQUFPLElBQUksS0FBSyxPQUFPLGtCQUFrQixPQUFPO0FBQUEsSUFDakQ7QUFBQSxFQUNEO0FBQ0Q7IiwKICAibmFtZXMiOiBbXQp9Cg==
