import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { ArrayEdit, MonotonousIndexTransformer, SingleArrayEdit } from "../../browser/arrayOperation.js";
suite("array operation", () => {
  function seq(start, end) {
    const result = [];
    for (let i = start; i < end; i++) {
      result.push(i);
    }
    return result;
  }
  test("simple", () => {
    const edit = new ArrayEdit([
      new SingleArrayEdit(4, 3, 2),
      new SingleArrayEdit(8, 0, 2),
      new SingleArrayEdit(9, 2, 0)
    ]);
    const arr = seq(0, 15).map((x) => `item${x}`);
    const newArr = arr.slice();
    edit.applyToArray(newArr);
    assert.deepStrictEqual(newArr, [
      "item0",
      "item1",
      "item2",
      "item3",
      void 0,
      void 0,
      "item7",
      void 0,
      void 0,
      "item8",
      "item11",
      "item12",
      "item13",
      "item14"
    ]);
    const transformer = new MonotonousIndexTransformer(edit);
    assert.deepStrictEqual(
      seq(0, 15).map((x) => {
        const t = transformer.transform(x);
        let r = `arr[${x}]: ${arr[x]} -> `;
        if (t !== void 0) {
          r += `newArr[${t}]: ${newArr[t]}`;
        } else {
          r += "undefined";
        }
        return r;
      }),
      [
        "arr[0]: item0 -> newArr[0]: item0",
        "arr[1]: item1 -> newArr[1]: item1",
        "arr[2]: item2 -> newArr[2]: item2",
        "arr[3]: item3 -> newArr[3]: item3",
        "arr[4]: item4 -> undefined",
        "arr[5]: item5 -> undefined",
        "arr[6]: item6 -> undefined",
        "arr[7]: item7 -> newArr[6]: item7",
        "arr[8]: item8 -> newArr[9]: item8",
        "arr[9]: item9 -> undefined",
        "arr[10]: item10 -> undefined",
        "arr[11]: item11 -> newArr[10]: item11",
        "arr[12]: item12 -> newArr[11]: item12",
        "arr[13]: item13 -> newArr[12]: item13",
        "arr[14]: item14 -> newArr[13]: item14"
      ]
    );
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGV4dE1hdGUvdGVzdC9icm93c2VyL2FycmF5T3BlcmF0aW9uLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IEFycmF5RWRpdCwgTW9ub3Rvbm91c0luZGV4VHJhbnNmb3JtZXIsIFNpbmdsZUFycmF5RWRpdCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvYXJyYXlPcGVyYXRpb24uanMnO1xuXG5zdWl0ZSgnYXJyYXkgb3BlcmF0aW9uJywgKCkgPT4ge1xuXHRmdW5jdGlvbiBzZXEoc3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXIpIHtcblx0XHRjb25zdCByZXN1bHQ6IG51bWJlcltdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcblx0XHRcdHJlc3VsdC5wdXNoKGkpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0dGVzdCgnc2ltcGxlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGVkaXQgPSBuZXcgQXJyYXlFZGl0KFtcblx0XHRcdG5ldyBTaW5nbGVBcnJheUVkaXQoNCwgMywgMiksXG5cdFx0XHRuZXcgU2luZ2xlQXJyYXlFZGl0KDgsIDAsIDIpLFxuXHRcdFx0bmV3IFNpbmdsZUFycmF5RWRpdCg5LCAyLCAwKSxcblx0XHRdKTtcblxuXHRcdGNvbnN0IGFyciA9IHNlcSgwLCAxNSkubWFwKHggPT4gYGl0ZW0ke3h9YCk7XG5cdFx0Y29uc3QgbmV3QXJyID0gYXJyLnNsaWNlKCk7XG5cblx0XHRlZGl0LmFwcGx5VG9BcnJheShuZXdBcnIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobmV3QXJyLCBbXG5cdFx0XHQnaXRlbTAnLFxuXHRcdFx0J2l0ZW0xJyxcblx0XHRcdCdpdGVtMicsXG5cdFx0XHQnaXRlbTMnLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0J2l0ZW03Jyxcblx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdCdpdGVtOCcsXG5cdFx0XHQnaXRlbTExJyxcblx0XHRcdCdpdGVtMTInLFxuXHRcdFx0J2l0ZW0xMycsXG5cdFx0XHQnaXRlbTE0Jyxcblx0XHRdKTtcblxuXHRcdGNvbnN0IHRyYW5zZm9ybWVyID0gbmV3IE1vbm90b25vdXNJbmRleFRyYW5zZm9ybWVyKGVkaXQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRzZXEoMCwgMTUpLm1hcCgoeCkgPT4ge1xuXHRcdFx0XHRjb25zdCB0ID0gdHJhbnNmb3JtZXIudHJhbnNmb3JtKHgpO1xuXHRcdFx0XHRsZXQgciA9IGBhcnJbJHt4fV06ICR7YXJyW3hdfSAtPiBgO1xuXHRcdFx0XHRpZiAodCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0ciArPSBgbmV3QXJyWyR7dH1dOiAke25ld0Fyclt0XX1gO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHIgKz0gJ3VuZGVmaW5lZCc7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHI7XG5cdFx0XHR9KSxcblx0XHRcdFtcblx0XHRcdFx0J2FyclswXTogaXRlbTAgLT4gbmV3QXJyWzBdOiBpdGVtMCcsXG5cdFx0XHRcdCdhcnJbMV06IGl0ZW0xIC0+IG5ld0FyclsxXTogaXRlbTEnLFxuXHRcdFx0XHQnYXJyWzJdOiBpdGVtMiAtPiBuZXdBcnJbMl06IGl0ZW0yJyxcblx0XHRcdFx0J2FyclszXTogaXRlbTMgLT4gbmV3QXJyWzNdOiBpdGVtMycsXG5cdFx0XHRcdCdhcnJbNF06IGl0ZW00IC0+IHVuZGVmaW5lZCcsXG5cdFx0XHRcdCdhcnJbNV06IGl0ZW01IC0+IHVuZGVmaW5lZCcsXG5cdFx0XHRcdCdhcnJbNl06IGl0ZW02IC0+IHVuZGVmaW5lZCcsXG5cdFx0XHRcdCdhcnJbN106IGl0ZW03IC0+IG5ld0Fycls2XTogaXRlbTcnLFxuXHRcdFx0XHQnYXJyWzhdOiBpdGVtOCAtPiBuZXdBcnJbOV06IGl0ZW04Jyxcblx0XHRcdFx0J2Fycls5XTogaXRlbTkgLT4gdW5kZWZpbmVkJyxcblx0XHRcdFx0J2FyclsxMF06IGl0ZW0xMCAtPiB1bmRlZmluZWQnLFxuXHRcdFx0XHQnYXJyWzExXTogaXRlbTExIC0+IG5ld0FyclsxMF06IGl0ZW0xMScsXG5cdFx0XHRcdCdhcnJbMTJdOiBpdGVtMTIgLT4gbmV3QXJyWzExXTogaXRlbTEyJyxcblx0XHRcdFx0J2FyclsxM106IGl0ZW0xMyAtPiBuZXdBcnJbMTJdOiBpdGVtMTMnLFxuXHRcdFx0XHQnYXJyWzE0XTogaXRlbTE0IC0+IG5ld0FyclsxM106IGl0ZW0xNCcsXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLCtDQUErQztBQUN4RCxTQUFTLFdBQVcsNEJBQTRCLHVCQUF1QjtBQUV2RSxNQUFNLG1CQUFtQixNQUFNO0FBQzlCLFdBQVMsSUFBSSxPQUFlLEtBQWE7QUFDeEMsVUFBTSxTQUFtQixDQUFDO0FBQzFCLGFBQVMsSUFBSSxPQUFPLElBQUksS0FBSyxLQUFLO0FBQ2pDLGFBQU8sS0FBSyxDQUFDO0FBQUEsSUFDZDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBRUEsT0FBSyxVQUFVLE1BQU07QUFDcEIsVUFBTSxPQUFPLElBQUksVUFBVTtBQUFBLE1BQzFCLElBQUksZ0JBQWdCLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDM0IsSUFBSSxnQkFBZ0IsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUMzQixJQUFJLGdCQUFnQixHQUFHLEdBQUcsQ0FBQztBQUFBLElBQzVCLENBQUM7QUFFRCxVQUFNLE1BQU0sSUFBSSxHQUFHLEVBQUUsRUFBRSxJQUFJLE9BQUssT0FBTyxDQUFDLEVBQUU7QUFDMUMsVUFBTSxTQUFTLElBQUksTUFBTTtBQUV6QixTQUFLLGFBQWEsTUFBTTtBQUN4QixXQUFPLGdCQUFnQixRQUFRO0FBQUEsTUFDOUI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxDQUFDO0FBRUQsVUFBTSxjQUFjLElBQUksMkJBQTJCLElBQUk7QUFDdkQsV0FBTztBQUFBLE1BQ04sSUFBSSxHQUFHLEVBQUUsRUFBRSxJQUFJLENBQUMsTUFBTTtBQUNyQixjQUFNLElBQUksWUFBWSxVQUFVLENBQUM7QUFDakMsWUFBSSxJQUFJLE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDO0FBQzVCLFlBQUksTUFBTSxRQUFXO0FBQ3BCLGVBQUssVUFBVSxDQUFDLE1BQU0sT0FBTyxDQUFDLENBQUM7QUFBQSxRQUNoQyxPQUFPO0FBQ04sZUFBSztBQUFBLFFBQ047QUFDQSxlQUFPO0FBQUEsTUFDUixDQUFDO0FBQUEsTUFDRDtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRCxDQUFDO0FBRUQsMENBQXdDO0FBQ3pDLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
