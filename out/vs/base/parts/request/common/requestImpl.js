import { bufferToStream, VSBuffer } from "../../../common/buffer.js";
import { canceled } from "../../../common/errors.js";
import { OfflineError } from "./request.js";
async function request(options, token, isOnline) {
  if (token.isCancellationRequested) {
    throw canceled();
  }
  const cancellation = new AbortController();
  const disposable = token.onCancellationRequested(() => cancellation.abort());
  const signal = options.timeout ? AbortSignal.any([
    cancellation.signal,
    AbortSignal.timeout(options.timeout)
  ]) : cancellation.signal;
  try {
    const fetchInit = {
      method: options.type || "GET",
      headers: getRequestHeaders(options),
      body: options.data,
      signal
    };
    if (options.disableCache) {
      fetchInit.cache = "no-store";
    }
    const res = await fetch(options.url || "", fetchInit);
    return {
      res: {
        statusCode: res.status,
        headers: getResponseHeaders(res)
      },
      stream: bufferToStream(VSBuffer.wrap(new Uint8Array(await res.arrayBuffer())))
    };
  } catch (err) {
    if (isOnline && !isOnline()) {
      throw new OfflineError();
    }
    if (err?.name === "AbortError") {
      throw canceled();
    }
    if (err?.name === "TimeoutError") {
      throw new Error(`Fetch timeout: ${options.timeout}ms`);
    }
    throw err;
  } finally {
    disposable.dispose();
  }
}
function getRequestHeaders(options) {
  if (options.headers || options.user || options.password || options.proxyAuthorization) {
    const headers = new Headers();
    outer: for (const k in options.headers) {
      switch (k.toLowerCase()) {
        case "user-agent":
        case "accept-encoding":
        case "content-length":
          continue outer;
      }
      const header = options.headers[k];
      if (typeof header === "string") {
        headers.set(k, header);
      } else if (Array.isArray(header)) {
        for (const h of header) {
          headers.append(k, h);
        }
      }
    }
    if (options.user || options.password) {
      headers.set("Authorization", "Basic " + btoa(`${options.user || ""}:${options.password || ""}`));
    }
    if (options.proxyAuthorization) {
      headers.set("Proxy-Authorization", options.proxyAuthorization);
    }
    return headers;
  }
  return void 0;
}
function getResponseHeaders(res) {
  const headers = /* @__PURE__ */ Object.create(null);
  res.headers.forEach((value, key) => {
    if (headers[key]) {
      if (Array.isArray(headers[key])) {
        headers[key].push(value);
      } else {
        headers[key] = [headers[key], value];
      }
    } else {
      headers[key] = value;
    }
  });
  return headers;
}
export {
  request
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3BhcnRzL3JlcXVlc3QvY29tbW9uL3JlcXVlc3RJbXBsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgYnVmZmVyVG9TdHJlYW0sIFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgY2FuY2VsZWQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IElIZWFkZXJzLCBJUmVxdWVzdENvbnRleHQsIElSZXF1ZXN0T3B0aW9ucywgT2ZmbGluZUVycm9yIH0gZnJvbSAnLi9yZXF1ZXN0LmpzJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlcXVlc3Qob3B0aW9uczogSVJlcXVlc3RPcHRpb25zLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIGlzT25saW5lPzogKCkgPT4gYm9vbGVhbik6IFByb21pc2U8SVJlcXVlc3RDb250ZXh0PiB7XG5cdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdHRocm93IGNhbmNlbGVkKCk7XG5cdH1cblxuXHRjb25zdCBjYW5jZWxsYXRpb24gPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG5cdGNvbnN0IGRpc3Bvc2FibGUgPSB0b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiBjYW5jZWxsYXRpb24uYWJvcnQoKSk7XG5cdGNvbnN0IHNpZ25hbCA9IG9wdGlvbnMudGltZW91dCA/IEFib3J0U2lnbmFsLmFueShbXG5cdFx0Y2FuY2VsbGF0aW9uLnNpZ25hbCxcblx0XHRBYm9ydFNpZ25hbC50aW1lb3V0KG9wdGlvbnMudGltZW91dCksXG5cdF0pIDogY2FuY2VsbGF0aW9uLnNpZ25hbDtcblxuXHR0cnkge1xuXHRcdGNvbnN0IGZldGNoSW5pdDogUmVxdWVzdEluaXQgPSB7XG5cdFx0XHRtZXRob2Q6IG9wdGlvbnMudHlwZSB8fCAnR0VUJyxcblx0XHRcdGhlYWRlcnM6IGdldFJlcXVlc3RIZWFkZXJzKG9wdGlvbnMpLFxuXHRcdFx0Ym9keTogb3B0aW9ucy5kYXRhLFxuXHRcdFx0c2lnbmFsXG5cdFx0fTtcblx0XHRpZiAob3B0aW9ucy5kaXNhYmxlQ2FjaGUpIHtcblx0XHRcdGZldGNoSW5pdC5jYWNoZSA9ICduby1zdG9yZSc7XG5cdFx0fVxuXHRcdGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKG9wdGlvbnMudXJsIHx8ICcnLCBmZXRjaEluaXQpO1xuXHRcdHJldHVybiB7XG5cdFx0XHRyZXM6IHtcblx0XHRcdFx0c3RhdHVzQ29kZTogcmVzLnN0YXR1cyxcblx0XHRcdFx0aGVhZGVyczogZ2V0UmVzcG9uc2VIZWFkZXJzKHJlcyksXG5cdFx0XHR9LFxuXHRcdFx0c3RyZWFtOiBidWZmZXJUb1N0cmVhbShWU0J1ZmZlci53cmFwKG5ldyBVaW50OEFycmF5KGF3YWl0IHJlcy5hcnJheUJ1ZmZlcigpKSkpLFxuXHRcdH07XG5cdH0gY2F0Y2ggKGVycikge1xuXHRcdGlmIChpc09ubGluZSAmJiAhaXNPbmxpbmUoKSkge1xuXHRcdFx0dGhyb3cgbmV3IE9mZmxpbmVFcnJvcigpO1xuXHRcdH1cblx0XHRpZiAoZXJyPy5uYW1lID09PSAnQWJvcnRFcnJvcicpIHtcblx0XHRcdHRocm93IGNhbmNlbGVkKCk7XG5cdFx0fVxuXHRcdGlmIChlcnI/Lm5hbWUgPT09ICdUaW1lb3V0RXJyb3InKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEZldGNoIHRpbWVvdXQ6ICR7b3B0aW9ucy50aW1lb3V0fW1zYCk7XG5cdFx0fVxuXHRcdHRocm93IGVycjtcblx0fSBmaW5hbGx5IHtcblx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRSZXF1ZXN0SGVhZGVycyhvcHRpb25zOiBJUmVxdWVzdE9wdGlvbnMpIHtcblx0aWYgKG9wdGlvbnMuaGVhZGVycyB8fCBvcHRpb25zLnVzZXIgfHwgb3B0aW9ucy5wYXNzd29yZCB8fCBvcHRpb25zLnByb3h5QXV0aG9yaXphdGlvbikge1xuXHRcdGNvbnN0IGhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuXHRcdG91dGVyOiBmb3IgKGNvbnN0IGsgaW4gb3B0aW9ucy5oZWFkZXJzKSB7XG5cdFx0XHRzd2l0Y2ggKGsudG9Mb3dlckNhc2UoKSkge1xuXHRcdFx0XHRjYXNlICd1c2VyLWFnZW50Jzpcblx0XHRcdFx0Y2FzZSAnYWNjZXB0LWVuY29kaW5nJzpcblx0XHRcdFx0Y2FzZSAnY29udGVudC1sZW5ndGgnOlxuXHRcdFx0XHRcdC8vIHVuc2FmZSBoZWFkZXJzXG5cdFx0XHRcdFx0Y29udGludWUgb3V0ZXI7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBoZWFkZXIgPSBvcHRpb25zLmhlYWRlcnNba107XG5cdFx0XHRpZiAodHlwZW9mIGhlYWRlciA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0aGVhZGVycy5zZXQoaywgaGVhZGVyKTtcblx0XHRcdH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShoZWFkZXIpKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgaCBvZiBoZWFkZXIpIHtcblx0XHRcdFx0XHRoZWFkZXJzLmFwcGVuZChrLCBoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAob3B0aW9ucy51c2VyIHx8IG9wdGlvbnMucGFzc3dvcmQpIHtcblx0XHRcdGhlYWRlcnMuc2V0KCdBdXRob3JpemF0aW9uJywgJ0Jhc2ljICcgKyBidG9hKGAke29wdGlvbnMudXNlciB8fCAnJ306JHtvcHRpb25zLnBhc3N3b3JkIHx8ICcnfWApKTtcblx0XHR9XG5cdFx0aWYgKG9wdGlvbnMucHJveHlBdXRob3JpemF0aW9uKSB7XG5cdFx0XHRoZWFkZXJzLnNldCgnUHJveHktQXV0aG9yaXphdGlvbicsIG9wdGlvbnMucHJveHlBdXRob3JpemF0aW9uKTtcblx0XHR9XG5cdFx0cmV0dXJuIGhlYWRlcnM7XG5cdH1cblx0cmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gZ2V0UmVzcG9uc2VIZWFkZXJzKHJlczogUmVzcG9uc2UpOiBJSGVhZGVycyB7XG5cdGNvbnN0IGhlYWRlcnM6IElIZWFkZXJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0cmVzLmhlYWRlcnMuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuXHRcdGlmIChoZWFkZXJzW2tleV0pIHtcblx0XHRcdGlmIChBcnJheS5pc0FycmF5KGhlYWRlcnNba2V5XSkpIHtcblx0XHRcdFx0aGVhZGVyc1trZXldLnB1c2godmFsdWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aGVhZGVyc1trZXldID0gW2hlYWRlcnNba2V5XSwgdmFsdWVdO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRoZWFkZXJzW2tleV0gPSB2YWx1ZTtcblx0XHR9XG5cdH0pO1xuXHRyZXR1cm4gaGVhZGVycztcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZ0JBQWdCLGdCQUFnQjtBQUV6QyxTQUFTLGdCQUFnQjtBQUN6QixTQUFxRCxvQkFBb0I7QUFFekUsZUFBc0IsUUFBUSxTQUEwQixPQUEwQixVQUFvRDtBQUNySSxNQUFJLE1BQU0seUJBQXlCO0FBQ2xDLFVBQU0sU0FBUztBQUFBLEVBQ2hCO0FBRUEsUUFBTSxlQUFlLElBQUksZ0JBQWdCO0FBQ3pDLFFBQU0sYUFBYSxNQUFNLHdCQUF3QixNQUFNLGFBQWEsTUFBTSxDQUFDO0FBQzNFLFFBQU0sU0FBUyxRQUFRLFVBQVUsWUFBWSxJQUFJO0FBQUEsSUFDaEQsYUFBYTtBQUFBLElBQ2IsWUFBWSxRQUFRLFFBQVEsT0FBTztBQUFBLEVBQ3BDLENBQUMsSUFBSSxhQUFhO0FBRWxCLE1BQUk7QUFDSCxVQUFNLFlBQXlCO0FBQUEsTUFDOUIsUUFBUSxRQUFRLFFBQVE7QUFBQSxNQUN4QixTQUFTLGtCQUFrQixPQUFPO0FBQUEsTUFDbEMsTUFBTSxRQUFRO0FBQUEsTUFDZDtBQUFBLElBQ0Q7QUFDQSxRQUFJLFFBQVEsY0FBYztBQUN6QixnQkFBVSxRQUFRO0FBQUEsSUFDbkI7QUFDQSxVQUFNLE1BQU0sTUFBTSxNQUFNLFFBQVEsT0FBTyxJQUFJLFNBQVM7QUFDcEQsV0FBTztBQUFBLE1BQ04sS0FBSztBQUFBLFFBQ0osWUFBWSxJQUFJO0FBQUEsUUFDaEIsU0FBUyxtQkFBbUIsR0FBRztBQUFBLE1BQ2hDO0FBQUEsTUFDQSxRQUFRLGVBQWUsU0FBUyxLQUFLLElBQUksV0FBVyxNQUFNLElBQUksWUFBWSxDQUFDLENBQUMsQ0FBQztBQUFBLElBQzlFO0FBQUEsRUFDRCxTQUFTLEtBQUs7QUFDYixRQUFJLFlBQVksQ0FBQyxTQUFTLEdBQUc7QUFDNUIsWUFBTSxJQUFJLGFBQWE7QUFBQSxJQUN4QjtBQUNBLFFBQUksS0FBSyxTQUFTLGNBQWM7QUFDL0IsWUFBTSxTQUFTO0FBQUEsSUFDaEI7QUFDQSxRQUFJLEtBQUssU0FBUyxnQkFBZ0I7QUFDakMsWUFBTSxJQUFJLE1BQU0sa0JBQWtCLFFBQVEsT0FBTyxJQUFJO0FBQUEsSUFDdEQ7QUFDQSxVQUFNO0FBQUEsRUFDUCxVQUFFO0FBQ0QsZUFBVyxRQUFRO0FBQUEsRUFDcEI7QUFDRDtBQUVBLFNBQVMsa0JBQWtCLFNBQTBCO0FBQ3BELE1BQUksUUFBUSxXQUFXLFFBQVEsUUFBUSxRQUFRLFlBQVksUUFBUSxvQkFBb0I7QUFDdEYsVUFBTSxVQUFVLElBQUksUUFBUTtBQUM1QixVQUFPLFlBQVcsS0FBSyxRQUFRLFNBQVM7QUFDdkMsY0FBUSxFQUFFLFlBQVksR0FBRztBQUFBLFFBQ3hCLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFFSixtQkFBUztBQUFBLE1BQ1g7QUFDQSxZQUFNLFNBQVMsUUFBUSxRQUFRLENBQUM7QUFDaEMsVUFBSSxPQUFPLFdBQVcsVUFBVTtBQUMvQixnQkFBUSxJQUFJLEdBQUcsTUFBTTtBQUFBLE1BQ3RCLFdBQVcsTUFBTSxRQUFRLE1BQU0sR0FBRztBQUNqQyxtQkFBVyxLQUFLLFFBQVE7QUFDdkIsa0JBQVEsT0FBTyxHQUFHLENBQUM7QUFBQSxRQUNwQjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQ0EsUUFBSSxRQUFRLFFBQVEsUUFBUSxVQUFVO0FBQ3JDLGNBQVEsSUFBSSxpQkFBaUIsV0FBVyxLQUFLLEdBQUcsUUFBUSxRQUFRLEVBQUUsSUFBSSxRQUFRLFlBQVksRUFBRSxFQUFFLENBQUM7QUFBQSxJQUNoRztBQUNBLFFBQUksUUFBUSxvQkFBb0I7QUFDL0IsY0FBUSxJQUFJLHVCQUF1QixRQUFRLGtCQUFrQjtBQUFBLElBQzlEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFDQSxTQUFPO0FBQ1I7QUFFQSxTQUFTLG1CQUFtQixLQUF5QjtBQUNwRCxRQUFNLFVBQW9CLHVCQUFPLE9BQU8sSUFBSTtBQUM1QyxNQUFJLFFBQVEsUUFBUSxDQUFDLE9BQU8sUUFBUTtBQUNuQyxRQUFJLFFBQVEsR0FBRyxHQUFHO0FBQ2pCLFVBQUksTUFBTSxRQUFRLFFBQVEsR0FBRyxDQUFDLEdBQUc7QUFDaEMsZ0JBQVEsR0FBRyxFQUFFLEtBQUssS0FBSztBQUFBLE1BQ3hCLE9BQU87QUFDTixnQkFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLEdBQUcsR0FBRyxLQUFLO0FBQUEsTUFDcEM7QUFBQSxJQUNELE9BQU87QUFDTixjQUFRLEdBQUcsSUFBSTtBQUFBLElBQ2hCO0FBQUEsRUFDRCxDQUFDO0FBQ0QsU0FBTztBQUNSOyIsCiAgIm5hbWVzIjogW10KfQo=
