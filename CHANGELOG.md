# Change Log

All notable changes to the "zscript" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Show definitions for multi-word strings

## [1.0.5]

- Commands to reparse current file and show parsed json (even if actual file was not saved)
- Fix showing parents in hover
- Support post docs in some places (///< ...)
- Support comma separated variables declaration in class
- Syntax coloring improvements
- Dump ignored strings to json for debugging
- Support access modifier (private/public/protected) for variables
- Preprocessor lines might be '\' terminated (untested)
- Fix definitions to show location of parent classes/interfaces correctly
- Outline view works (see file pane)

## [1.0.4]

- Some language services - completion, hover, definition. (no LSP yet)
- debug uses ".\<command\>" to execute internal commands, while the rest is passed to powerup process
- Regular problem matcher
- Separate problem matching over console message while debug is being run
- Save parsed info to disk and load it on startup

## [1.0.3]

- package cleanup

## [1.0.2]

- Improve syntax highlighting
- Show values on hover (does not work with property getters)
- Always show showApplicationOutput while debugger is not connected

## [1.0.1]

- Ensure listening socket is closed on terminateRequest and created on launchRequest only

## [1.0.0]

- Initial release.
- Features supported:
  - syntax highlighting: basic implementation
  - debugger (inline - fully embedded into package, no external processes to run)
    - breakpoints
    - step in/step out/step/continue
    - stack trace
    - variables inspection
    - deep variable inspection
    - Optionally run external app, specifying cwd, args, env
    - Watch after external app
    - When app is running, accept debugger commands to bypass to input (in ...)
