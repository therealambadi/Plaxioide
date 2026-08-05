import { FilterType, SortBy } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { EXTENSION_CATEGORIES } from "../../../../platform/extensions/common/extensions.js";
class Query {
  constructor(value, sortBy) {
    this.value = value;
    this.sortBy = sortBy;
    this.value = value.trim();
  }
  static suggestions(query, galleryManifest) {
    const commands = ["installed", "updates", "enabled", "disabled", "builtin"];
    if (galleryManifest?.capabilities.extensionQuery?.filtering?.some((c) => c.name === FilterType.Featured)) {
      commands.push("featured");
    }
    commands.push(...["popular", "recommended", "recentlyPublished", "workspaceUnsupported", "deprecated", "sort"]);
    const isCategoriesEnabled = galleryManifest?.capabilities.extensionQuery?.filtering?.some((c) => c.name === FilterType.Category);
    if (isCategoriesEnabled) {
      commands.push("category");
    }
    commands.push(...["tag", "ext", "id", "outdated", "recentlyUpdated"]);
    const sortCommands = [];
    if (galleryManifest?.capabilities.extensionQuery?.sorting?.some((c) => c.name === SortBy.InstallCount)) {
      sortCommands.push("installs");
    }
    if (galleryManifest?.capabilities.extensionQuery?.sorting?.some((c) => c.name === SortBy.WeightedRating)) {
      sortCommands.push("rating");
    }
    sortCommands.push("name", "publishedDate", "updateDate");
    const subcommands = {
      "sort": sortCommands,
      "category": isCategoriesEnabled ? EXTENSION_CATEGORIES.map((c) => `"${c.toLowerCase()}"`) : [],
      "tag": [""],
      "ext": [""],
      "id": [""]
    };
    const queryContains = (substr) => query.indexOf(substr) > -1;
    const hasSort = subcommands.sort.some((subcommand) => queryContains(`@sort:${subcommand}`));
    const hasCategory = subcommands.category.some((subcommand) => queryContains(`@category:${subcommand}`));
    return commands.flatMap((command) => {
      if (hasSort && command === "sort" || hasCategory && command === "category") {
        return [];
      }
      if (command in subcommands) {
        return subcommands[command].map((subcommand) => `@${command}:${subcommand}${subcommand === "" ? "" : " "}`);
      } else {
        return queryContains(`@${command}`) ? [] : [`@${command} `];
      }
    });
  }
  static parse(value) {
    let sortBy = "";
    value = value.replace(/@sort:(\w+)(-\w*)?/g, (match, by, order) => {
      sortBy = by;
      return "";
    });
    return new Query(value, sortBy);
  }
  toString() {
    let result = this.value;
    if (this.sortBy) {
      result = `${result}${result ? " " : ""}@sort:${this.sortBy}`;
    }
    return result;
  }
  isValid() {
    return !/@outdated/.test(this.value);
  }
  equals(other) {
    return this.value === other.value && this.sortBy === other.sortBy;
  }
}
export {
  Query
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25RdWVyeS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QuanMnO1xuaW1wb3J0IHsgRmlsdGVyVHlwZSwgU29ydEJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBFWFRFTlNJT05fQ0FURUdPUklFUyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuXG5leHBvcnQgY2xhc3MgUXVlcnkge1xuXG5cdGNvbnN0cnVjdG9yKHB1YmxpYyB2YWx1ZTogc3RyaW5nLCBwdWJsaWMgc29ydEJ5OiBzdHJpbmcpIHtcblx0XHR0aGlzLnZhbHVlID0gdmFsdWUudHJpbSgpO1xuXHR9XG5cblx0c3RhdGljIHN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcsIGdhbGxlcnlNYW5pZmVzdDogSUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCB8IG51bGwpOiBzdHJpbmdbXSB7XG5cblx0XHRjb25zdCBjb21tYW5kcyA9IFsnaW5zdGFsbGVkJywgJ3VwZGF0ZXMnLCAnZW5hYmxlZCcsICdkaXNhYmxlZCcsICdidWlsdGluJ107XG5cdFx0aWYgKGdhbGxlcnlNYW5pZmVzdD8uY2FwYWJpbGl0aWVzLmV4dGVuc2lvblF1ZXJ5Py5maWx0ZXJpbmc/LnNvbWUoYyA9PiBjLm5hbWUgPT09IEZpbHRlclR5cGUuRmVhdHVyZWQpKSB7XG5cdFx0XHRjb21tYW5kcy5wdXNoKCdmZWF0dXJlZCcpO1xuXHRcdH1cblxuXHRcdGNvbW1hbmRzLnB1c2goLi4uWydwb3B1bGFyJywgJ3JlY29tbWVuZGVkJywgJ3JlY2VudGx5UHVibGlzaGVkJywgJ3dvcmtzcGFjZVVuc3VwcG9ydGVkJywgJ2RlcHJlY2F0ZWQnLCAnc29ydCddKTtcblx0XHRjb25zdCBpc0NhdGVnb3JpZXNFbmFibGVkID0gZ2FsbGVyeU1hbmlmZXN0Py5jYXBhYmlsaXRpZXMuZXh0ZW5zaW9uUXVlcnk/LmZpbHRlcmluZz8uc29tZShjID0+IGMubmFtZSA9PT0gRmlsdGVyVHlwZS5DYXRlZ29yeSk7XG5cdFx0aWYgKGlzQ2F0ZWdvcmllc0VuYWJsZWQpIHtcblx0XHRcdGNvbW1hbmRzLnB1c2goJ2NhdGVnb3J5Jyk7XG5cdFx0fVxuXG5cdFx0Y29tbWFuZHMucHVzaCguLi5bJ3RhZycsICdleHQnLCAnaWQnLCAnb3V0ZGF0ZWQnLCAncmVjZW50bHlVcGRhdGVkJ10pO1xuXHRcdGNvbnN0IHNvcnRDb21tYW5kcyA9IFtdO1xuXHRcdGlmIChnYWxsZXJ5TWFuaWZlc3Q/LmNhcGFiaWxpdGllcy5leHRlbnNpb25RdWVyeT8uc29ydGluZz8uc29tZShjID0+IGMubmFtZSA9PT0gU29ydEJ5Lkluc3RhbGxDb3VudCkpIHtcblx0XHRcdHNvcnRDb21tYW5kcy5wdXNoKCdpbnN0YWxscycpO1xuXHRcdH1cblx0XHRpZiAoZ2FsbGVyeU1hbmlmZXN0Py5jYXBhYmlsaXRpZXMuZXh0ZW5zaW9uUXVlcnk/LnNvcnRpbmc/LnNvbWUoYyA9PiBjLm5hbWUgPT09IFNvcnRCeS5XZWlnaHRlZFJhdGluZykpIHtcblx0XHRcdHNvcnRDb21tYW5kcy5wdXNoKCdyYXRpbmcnKTtcblx0XHR9XG5cdFx0c29ydENvbW1hbmRzLnB1c2goJ25hbWUnLCAncHVibGlzaGVkRGF0ZScsICd1cGRhdGVEYXRlJyk7XG5cblx0XHRjb25zdCBzdWJjb21tYW5kcyA9IHtcblx0XHRcdCdzb3J0Jzogc29ydENvbW1hbmRzLFxuXHRcdFx0J2NhdGVnb3J5JzogaXNDYXRlZ29yaWVzRW5hYmxlZCA/IEVYVEVOU0lPTl9DQVRFR09SSUVTLm1hcChjID0+IGBcIiR7Yy50b0xvd2VyQ2FzZSgpfVwiYCkgOiBbXSxcblx0XHRcdCd0YWcnOiBbJyddLFxuXHRcdFx0J2V4dCc6IFsnJ10sXG5cdFx0XHQnaWQnOiBbJyddXG5cdFx0fSBhcyBjb25zdDtcblxuXHRcdGNvbnN0IHF1ZXJ5Q29udGFpbnMgPSAoc3Vic3RyOiBzdHJpbmcpID0+IHF1ZXJ5LmluZGV4T2Yoc3Vic3RyKSA+IC0xO1xuXHRcdGNvbnN0IGhhc1NvcnQgPSBzdWJjb21tYW5kcy5zb3J0LnNvbWUoc3ViY29tbWFuZCA9PiBxdWVyeUNvbnRhaW5zKGBAc29ydDoke3N1YmNvbW1hbmR9YCkpO1xuXHRcdGNvbnN0IGhhc0NhdGVnb3J5ID0gc3ViY29tbWFuZHMuY2F0ZWdvcnkuc29tZShzdWJjb21tYW5kID0+IHF1ZXJ5Q29udGFpbnMoYEBjYXRlZ29yeToke3N1YmNvbW1hbmR9YCkpO1xuXG5cdFx0cmV0dXJuIGNvbW1hbmRzLmZsYXRNYXAoY29tbWFuZCA9PiB7XG5cdFx0XHRpZiAoaGFzU29ydCAmJiBjb21tYW5kID09PSAnc29ydCcgfHwgaGFzQ2F0ZWdvcnkgJiYgY29tbWFuZCA9PT0gJ2NhdGVnb3J5Jykge1xuXHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHR9XG5cdFx0XHRpZiAoY29tbWFuZCBpbiBzdWJjb21tYW5kcykge1xuXHRcdFx0XHRyZXR1cm4gKHN1YmNvbW1hbmRzIGFzIFJlY29yZDxzdHJpbmcsIHJlYWRvbmx5IHN0cmluZ1tdPilbY29tbWFuZF1cblx0XHRcdFx0XHQubWFwKHN1YmNvbW1hbmQgPT4gYEAke2NvbW1hbmR9OiR7c3ViY29tbWFuZH0ke3N1YmNvbW1hbmQgPT09ICcnID8gJycgOiAnICd9YCk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHF1ZXJ5Q29udGFpbnMoYEAke2NvbW1hbmR9YCkgPyBbXSA6IFtgQCR7Y29tbWFuZH0gYF07XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRzdGF0aWMgcGFyc2UodmFsdWU6IHN0cmluZyk6IFF1ZXJ5IHtcblx0XHRsZXQgc29ydEJ5ID0gJyc7XG5cdFx0dmFsdWUgPSB2YWx1ZS5yZXBsYWNlKC9Ac29ydDooXFx3KykoLVxcdyopPy9nLCAobWF0Y2gsIGJ5OiBzdHJpbmcsIG9yZGVyOiBzdHJpbmcpID0+IHtcblx0XHRcdHNvcnRCeSA9IGJ5O1xuXG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIG5ldyBRdWVyeSh2YWx1ZSwgc29ydEJ5KTtcblx0fVxuXG5cdHRvU3RyaW5nKCk6IHN0cmluZyB7XG5cdFx0bGV0IHJlc3VsdCA9IHRoaXMudmFsdWU7XG5cblx0XHRpZiAodGhpcy5zb3J0QnkpIHtcblx0XHRcdHJlc3VsdCA9IGAke3Jlc3VsdH0ke3Jlc3VsdCA/ICcgJyA6ICcnfUBzb3J0OiR7dGhpcy5zb3J0Qnl9YDtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGlzVmFsaWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEvQG91dGRhdGVkLy50ZXN0KHRoaXMudmFsdWUpO1xuXHR9XG5cblx0ZXF1YWxzKG90aGVyOiBRdWVyeSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnZhbHVlID09PSBvdGhlci52YWx1ZSAmJiB0aGlzLnNvcnRCeSA9PT0gb3RoZXIuc29ydEJ5O1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxTQUFTLFlBQVksY0FBYztBQUNuQyxTQUFTLDRCQUE0QjtBQUU5QixNQUFNLE1BQU07QUFBQSxFQUVsQixZQUFtQixPQUFzQixRQUFnQjtBQUF0QztBQUFzQjtBQUN4QyxTQUFLLFFBQVEsTUFBTSxLQUFLO0FBQUEsRUFDekI7QUFBQSxFQUVBLE9BQU8sWUFBWSxPQUFlLGlCQUE2RDtBQUU5RixVQUFNLFdBQVcsQ0FBQyxhQUFhLFdBQVcsV0FBVyxZQUFZLFNBQVM7QUFDMUUsUUFBSSxpQkFBaUIsYUFBYSxnQkFBZ0IsV0FBVyxLQUFLLE9BQUssRUFBRSxTQUFTLFdBQVcsUUFBUSxHQUFHO0FBQ3ZHLGVBQVMsS0FBSyxVQUFVO0FBQUEsSUFDekI7QUFFQSxhQUFTLEtBQUssR0FBRyxDQUFDLFdBQVcsZUFBZSxxQkFBcUIsd0JBQXdCLGNBQWMsTUFBTSxDQUFDO0FBQzlHLFVBQU0sc0JBQXNCLGlCQUFpQixhQUFhLGdCQUFnQixXQUFXLEtBQUssT0FBSyxFQUFFLFNBQVMsV0FBVyxRQUFRO0FBQzdILFFBQUkscUJBQXFCO0FBQ3hCLGVBQVMsS0FBSyxVQUFVO0FBQUEsSUFDekI7QUFFQSxhQUFTLEtBQUssR0FBRyxDQUFDLE9BQU8sT0FBTyxNQUFNLFlBQVksaUJBQWlCLENBQUM7QUFDcEUsVUFBTSxlQUFlLENBQUM7QUFDdEIsUUFBSSxpQkFBaUIsYUFBYSxnQkFBZ0IsU0FBUyxLQUFLLE9BQUssRUFBRSxTQUFTLE9BQU8sWUFBWSxHQUFHO0FBQ3JHLG1CQUFhLEtBQUssVUFBVTtBQUFBLElBQzdCO0FBQ0EsUUFBSSxpQkFBaUIsYUFBYSxnQkFBZ0IsU0FBUyxLQUFLLE9BQUssRUFBRSxTQUFTLE9BQU8sY0FBYyxHQUFHO0FBQ3ZHLG1CQUFhLEtBQUssUUFBUTtBQUFBLElBQzNCO0FBQ0EsaUJBQWEsS0FBSyxRQUFRLGlCQUFpQixZQUFZO0FBRXZELFVBQU0sY0FBYztBQUFBLE1BQ25CLFFBQVE7QUFBQSxNQUNSLFlBQVksc0JBQXNCLHFCQUFxQixJQUFJLE9BQUssSUFBSSxFQUFFLFlBQVksQ0FBQyxHQUFHLElBQUksQ0FBQztBQUFBLE1BQzNGLE9BQU8sQ0FBQyxFQUFFO0FBQUEsTUFDVixPQUFPLENBQUMsRUFBRTtBQUFBLE1BQ1YsTUFBTSxDQUFDLEVBQUU7QUFBQSxJQUNWO0FBRUEsVUFBTSxnQkFBZ0IsQ0FBQyxXQUFtQixNQUFNLFFBQVEsTUFBTSxJQUFJO0FBQ2xFLFVBQU0sVUFBVSxZQUFZLEtBQUssS0FBSyxnQkFBYyxjQUFjLFNBQVMsVUFBVSxFQUFFLENBQUM7QUFDeEYsVUFBTSxjQUFjLFlBQVksU0FBUyxLQUFLLGdCQUFjLGNBQWMsYUFBYSxVQUFVLEVBQUUsQ0FBQztBQUVwRyxXQUFPLFNBQVMsUUFBUSxhQUFXO0FBQ2xDLFVBQUksV0FBVyxZQUFZLFVBQVUsZUFBZSxZQUFZLFlBQVk7QUFDM0UsZUFBTyxDQUFDO0FBQUEsTUFDVDtBQUNBLFVBQUksV0FBVyxhQUFhO0FBQzNCLGVBQVEsWUFBa0QsT0FBTyxFQUMvRCxJQUFJLGdCQUFjLElBQUksT0FBTyxJQUFJLFVBQVUsR0FBRyxlQUFlLEtBQUssS0FBSyxHQUFHLEVBQUU7QUFBQSxNQUMvRSxPQUNLO0FBQ0osZUFBTyxjQUFjLElBQUksT0FBTyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxPQUFPLEdBQUc7QUFBQSxNQUMzRDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLE9BQU8sTUFBTSxPQUFzQjtBQUNsQyxRQUFJLFNBQVM7QUFDYixZQUFRLE1BQU0sUUFBUSx1QkFBdUIsQ0FBQyxPQUFPLElBQVksVUFBa0I7QUFDbEYsZUFBUztBQUVULGFBQU87QUFBQSxJQUNSLENBQUM7QUFDRCxXQUFPLElBQUksTUFBTSxPQUFPLE1BQU07QUFBQSxFQUMvQjtBQUFBLEVBRUEsV0FBbUI7QUFDbEIsUUFBSSxTQUFTLEtBQUs7QUFFbEIsUUFBSSxLQUFLLFFBQVE7QUFDaEIsZUFBUyxHQUFHLE1BQU0sR0FBRyxTQUFTLE1BQU0sRUFBRSxTQUFTLEtBQUssTUFBTTtBQUFBLElBQzNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLFVBQW1CO0FBQ2xCLFdBQU8sQ0FBQyxZQUFZLEtBQUssS0FBSyxLQUFLO0FBQUEsRUFDcEM7QUFBQSxFQUVBLE9BQU8sT0FBdUI7QUFDN0IsV0FBTyxLQUFLLFVBQVUsTUFBTSxTQUFTLEtBQUssV0FBVyxNQUFNO0FBQUEsRUFDNUQ7QUFDRDsiLAogICJuYW1lcyI6IFtdCn0K
