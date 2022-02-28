import { assert } from "https://deno.land/std@0.127.0/testing/asserts.ts";
import { Node } from "https://deno.land/x/router@v2.0.1/mod.ts";
import {
  format,
  sync,
} from "https://gist.githubusercontent.com/evanwashere/7ee592870e46f80405b9776dcd56e1e8/raw/1abb85cb294831b6f3a9873965a4ded65faa3852/bench.js";

const root = new Node<string>();
root.add("/companies", "01");
root.add("/companies/:id", "02");
root.add("/companies/:id/users", "03");
root.add("/companies/:id/users/:id", "04");
root.add("/users", "05");
root.add("/users/:id", "06");
root.add("/users/:id/*file", "07");

console.log(format({
  locale: "de-de",
  title: "deno.land/x/router",
  results: {
    "/companies": sync(
      1e6,
      () => assert(root.find("/companies")[0] === "01"),
    ),
    "/companies/:id": sync(
      1e6,
      () => assert(root.find("/companies/cool-id-1234")[0] === "02"),
    ),
    "/companies/:id/users": sync(
      1e6,
      () => assert(root.find("/companies/cool-id-1234/users")[0] === "03"),
    ),
    "/companies/:id/users/:id": sync(
      1e6,
      () =>
        assert(
          root.find("/companies/cool-id-1234/users/12345-lol")[0] === "04",
        ),
    ),
    "/users": sync(1e6, () => assert(root.find("/users")[0] === "05")),
    "/users/:id": sync(
      1e6,
      () => assert(root.find("/users/cool-id-1234")[0] === "06"),
    ),
    "/users/:id/*file": sync(
      1e6,
      () =>
        assert(root.find("/users/cool-id-1234/some/file.png")[0] === "07"),
    ),
  },
}));
