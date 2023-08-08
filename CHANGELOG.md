# Change Log

All notable changes to the "zscript" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

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
