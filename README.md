# Zodiac Script

## Features

- Syntax coloring: basic support

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.

## Links

### Language Server Protocol

- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
- Extenstion shows some suggestions for another ZScript: https://github.com/drage0/ZScript-vscode

### Debug

- [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/specification)

- [MockDebug](https://github.com/microsoft/vscode-mock-debug/blob/main/src/mockDebug.ts)
- [Debugger Extension guide](https://code.visualstudio.com/api/extension-guides/debugger-extension)
- [Debug adapter protocol and default implementation for VS Code](https://github.com/microsoft/vscode-debugadapter-node/tree/main)
- [Go Language vscode extension](https://github.com/golang/vscode-go)

### Syntax coloring

- [Syntax Highlight guide](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide)
- [Semantic highlight guide](https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide)
- [Color Theme](https://code.visualstudio.com/api/extension-guides/color-theme#syntax-colors)

- [Writing a TextMate Grammar: Some Lessons Learned](https://www.apeth.com/nonblog/stories/textmatebundle.html)
- [TextMate language grammars](https://macromates.com/manual/en/language_grammars)

## TODO

- real LSP
- save indexing to disk
- Entities:
  - [x] interface
  - [x] class
  - [x] type
  - [x] this
  - [x] global functions
  - [x] global variables
  - [x] member function
  - [x] member variables
  - [x] local functions
  - [ ] namespace
  - [ ] event
  - [ ] final
  - [ ] abstract
  - [ ] static
  - [ ] enum
  - [ ] struct
  - [ ] implements LIST
  - [ ] extends LIST
  - [ ] extern
  - [ ] native
