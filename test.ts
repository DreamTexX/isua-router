import { format, sync } from "https://gist.githubusercontent.com/evanwashere/7ee592870e46f80405b9776dcd56e1e8/raw/1abb85cb294831b6f3a9873965a4ded65faa3852/bench.js"
import { assert } from "https://deno.land/std@0.127.0/testing/asserts.ts"
import { Node } from "./node.ts"

const root = new Node<string>();
root.add("/users/", "01");
root.add("/users/*catchall", "02");
root.add("/users/static/*filename", "03");
root.add("/users/:id(/[0-9]{1,10}/ig)/*filename", "04");
root.add("/users/:id(/[0-9]{1,10}/ig)/internal/*filename", "05");
root.add("/test/regex/prefix-:param([a-z]*)", "06");
root.add("/test/regex/:param([a-z]{3})suffix", "07");
root.add("/test/wildcard/prefix*wildcard", "08");
root.add("/test/param/prefix:param", "09");
root.add("/:param(/[a-z]*/i)/", "10");
root.add("/users/static/static/*filename", "11");

console.log(format({
  percentiles: true,
  locale: "de-de",
  results: {
    "/users/": sync(1e5, () => assert(root.lookup("/users/")[0] === "01")),
    "/users/*catchall": sync(1e5, () => assert(root.lookup("/users/this-should-be-catched")[0] === "02")),
    "/users/static/*filename": sync(1e5, () => assert(root.lookup("/users/static/some-file.png")[0] === "03")),
    "/users/:id(/[0-9]{1,10}/ig)/*filename": sync(1e5, () => assert(root.lookup("/users/" + Math.random().toFixed(4).substring(2) + "/some-file.png")[0] === "04")),
    "/users/:id(/[0-9]{1,10}/ig)/internal/*filename": sync(1e5, () => assert(root.lookup("/users/1234/internal/some-file.png")[0] === "05")),
    "/test/regex/prefix-:param([a-z]*)": sync(1e5, () => assert(root.lookup("/test/regex/prefix-abcdef")[0] === "06")),
    "/test/regex/:param([a-z]{3})suffix": sync(1e5, () => assert(root.lookup("/test/regex/abcsuffix")[0] === "07")),
    "/test/wildcard/prefix*wildcard": sync(1e5, () => assert(root.lookup("/test/wildcard/prefix-with-cool-wildcard")[0] === "08")),
    "/test/param/prefix:param": sync(1e5, () => assert(root.lookup("/test/param/prefix-with-cool-parameter")[0] === "09")),
    "/:param(/[a-z]*/i)/": sync(1e5, () => assert(root.lookup("/abcdefG/")[0] === "10")),
    "/users/static/static/*filename": sync(1e5, () => assert(root.lookup("/users/static/static/cool/filename.png")[0] === "11")),
  }
}));