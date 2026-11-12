# SillyTavern Plain Creator Notes

...in character listing:

![](./.github/img/screenshot.png)

## What it solves

Importing cards from various sources has creator notes embedded on it. SillyTavern shows it as it is: the raw HTML syntax, resulting in noise. This extension removes it and shows the actual text you want to read.

## Installation

Extensions > Install Extension > Paste the link below > Install

```
https://github.com/rp-coderer/SillyTavern-Plain-Creator-Notes
```

## Configuration

Nothing. It just works(tm). And nothing is changed on the cards, just the display.

## How it works

This extension hooks a `MutationObserver` on `#rm_print_characters_block` on ST's launch. And it checks each `.ch_description` (which is gathered with `querySelectorAll`), then checks if there's `<` or `&` (common HTML chars) in the creator notes before doing HTML stripping.

Characters with just plain text (or just plain markdown, really) are skipped.

Checks happen whenever `#rm_print_characters_block`'s layout changes and changes only happen once per browser frame.

Utilizes `<template>`s to access `nodeValue` on per `element` found. Slower than regex, but more consistent. Performance shouldn't tank.

If my own explanation sucks, just read [index.js](index.js) man.

## AI Disclosure

It's 100% vibe-coded! Except this README. I wrote this. I contributed :D

Model used: DeepSeek V4.1 Flash 1017 (max) on DeepSeek Harness

## License

**Unlicense**
