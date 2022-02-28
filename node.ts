export class Node<T> {
  path = "";
  compiledRegex: RegExp | undefined;
  handler?: T = undefined;
  paramName?: string = undefined;
  children: Map<string, Node<T>> = new Map();

  constructor(data?: Partial<Node<T>>) {
    Object.assign(this, data);
  }

  public lookup(p: string): [T | undefined, Map<string, string>] {
    const params: Map<string, string> = new Map();
    const stack: Array<[Node<T>, boolean, string]> = [[this, false, p]];
    let handler: T | undefined;

    for (let i = 0; i >= 0; ) {
      const [node, checked, path] = stack[i];
      let restPath: string | undefined;

      if (checked) {
        --i;
        continue;
      } else {
        stack[i][1] = true;
      }

      if (node.path[0] === "*") {
        params.set(node.paramName ?? node.path.slice(1), path);
        restPath = undefined;
      } else if (node.path[0] === ":") {
        let index;
        if (node.compiledRegex) {
          node.compiledRegex.lastIndex = 0;
          const result = node.compiledRegex.exec(path);
          if (!result) {
            --i;
            continue;
          }
          index = result[0].length;
        } else {
          index = path.indexOf("/");
        }
        if (index < 0) {
          index = path.length;
        }
        restPath = path.slice(index);
        const name = node.paramName ?? node.path.match(/^:(?<name>[a-zA-Z0-9._-]+)/)!.groups!.name;
        params.set(name, path.slice(0, index));
      } else {
        const lcp = this.#longestCommonPrefix(node.path, path);
        if (lcp !== node.path.length) {
          --i;
          continue;
        } else {
          restPath = path.slice(lcp);
        }
      }

      if (!restPath) {
        handler = node.handler;
        break;
      }

      let c = node.children.get("*");
      if (c) {
        stack[++i] = [c, false, restPath];
      }

      if (restPath === "") {
        continue;
      }

      c = node.children.get(":");
      if (c) {
        stack[++i] = [c, false, restPath];
      }

      c = node.children.get(restPath[0]);
      if (c) {
        stack[++i] = [c, false, restPath];
      }
    }

    return [handler, params];
  }

  public add(path: string, handler?: T): Node<T> {
    // deno-lint-ignore no-this-alias
    let currentNode: Node<T> = this;
    let start = 0;
    for (let end = start; end < path.length; end++) {
      if (this.#isWildcard(path[end])) {
        currentNode = currentNode.#merge(path.slice(start, end));
        const wildcard = path[end];
        start = end;
        if (wildcard === "*") {
          end = path.length;
          const name = path.slice(start, end);
          if (name.match(/^\*[a-z0-9\._\-]*$/i) === null) {
            throw new Error(
              `Invalid parameter name for wildcard *, can only contain a-z, A-Z, 0-9, ., _, -, but is: ${name.substring(
                1
              )}`
            );
          }

          const child = new Node<T>({
            path: name,
            paramName: name.slice(1),
          });
          currentNode.children.set(wildcard, child);
          currentNode = child;
          start = end;
          break;
        }
        if (wildcard === ":") {
          const restPath = path.slice(start);
          const match = restPath.match(
            /^(?<name>:[a-zA-Z0-9._-]+)(?<regex>\(.+?\))?/
          );
          if (!match) {
            throw new Error(
              `Wildcard does not match requirements, provided "${restPath}" but needed in form of ":required_parameter-name(optional regex)/optional path"`
            );
          }
          end += match[0].length;

          const name = match[0];
          let regex: RegExp | undefined;
          if (match.groups?.regex) {
            try {
              regex = this.#transformRegExp(match.groups!.regex);
            } catch (e) {
              throw new Error(
                `Invalid regular expression: "${match.groups!.regex.substring(
                  1,
                  match.groups!.regex.length - 1
                )}": ${e}`
              );
            }
          }

          let child: Node<T> | undefined = currentNode.children.get(wildcard);
          if (child) {
            if (child.path !== name) {
              throw new Error(
                `URL segment parameter name mismatch, currently one parameter with name "${child.path}" is registered, but need to add "${name}". Please choose equal parameter names for this segment"`
              );
            }
            if (regex) {
              if (!child.compiledRegex) {
                throw new Error(
                  `Cannot add regex to already existing parameter: "${child.path}"`
                );
              }
              if (child.compiledRegex.toString() !== regex.toString()) {
                throw new Error(
                  `Cannot change regex of existing parameter "${child.path}" from "${child.compiledRegex}" to "${regex}"`
                );
              }
            }
          } else {
            child = new Node<T>({
              path: name,
              compiledRegex: regex,
              paramName: match.groups!.name
            });
            currentNode.children.set(wildcard, child);
          }
          currentNode = child;
        }
      }
    }
    if (start < path.length) {
      currentNode = currentNode.#merge(path.slice(start));
    }
    currentNode.handler = handler;
    return currentNode;
  }

  #merge(path: string): Node<T> {
    // deno-lint-ignore no-this-alias
    let currentNode: Node<T> = this;
    const lcp = this.#longestCommonPrefix(path, this.path);

    if (lcp === 0 && currentNode.children.size === 0) {
      currentNode.path = path;
      return currentNode;
    }

    if (lcp < currentNode.path.length) {
      const child = new Node({
        path: currentNode.path.slice(lcp),
        children: currentNode.children,
        handler: currentNode.handler,
      });
      currentNode.path = path.slice(0, lcp);
      currentNode.children = new Map([[child.path[0], child]]);
      currentNode.handler = undefined;
    }

    if (lcp < path.length) {
      if (currentNode.children.has(path[lcp])) {
        /*TODO(@DreamTexX): Remove recursive, resource intensive call to Node#add and replace with loop
         *                   Call is not needed, only static paths will be inserted here, wilcards are filtered before
         */
        currentNode = currentNode.children.get(path[lcp])!.add(path.slice(lcp));
      } else {
        const child = new Node<T>({
          path: path.slice(lcp),
        });
        currentNode.children.set(path[lcp], child);
        currentNode = child;
      }
    }

    return currentNode;
  }

  #longestCommonPrefix(a: string, b: string): number {
    let i = 0;
    const len = Math.min(a.length, b.length);
    for (; i < len && a[i] === b[i]; ++i);
    return i;
  }

  #isWildcard(char: string): boolean {
    return [":", "*"].includes(char);
  }

  #transformRegExp(regex: string): RegExp {
    if (regex.startsWith("(")) regex = regex.substring(1);
    if (regex.endsWith(")")) regex = regex.substring(0, regex.length - 1);
    if (regex.startsWith("/")) {
      const lio = regex.lastIndexOf("/");
      const pattern = regex.substring(1, lio);
      const flags = regex.substring(lio + 1);
      return new RegExp(pattern, flags);
    }

    return new RegExp(regex);
  }
}
