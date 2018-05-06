# projections [![Build Status](https://travis-ci.org/michalc/projections.svg?branch=master)](https://travis-ci.org/michalc/projections) [![codecov](https://codecov.io/gh/michalc/projections/branch/master/graph/badge.svg)](https://codecov.io/gh/michalc/projections)

Source for http://projections.charemza.name/

## What does this do?

It shows the world using a spherical Mercator projection, but allows the world to be rotated first, by dragging.

## Why do this?

I enjoy thinking "what if?", especially if "if" is something that challenges views that are somewhat arbitrary, limit thinking, or are misleading. The view of the world that the Mercator projection promotes is a good example:

  - regions are shown as though they have a larger area near the poles;
  - shapes are stretched near the poles;
  - it's impossible to show all of the Earth on the map at once;
  - it's not obvious that the regions on the left are close to the regions on the right;
  - it's not obvious that regions at the top are all close to each other, or that the regions at the bottom are close to each other;
  - it's not obvious that the shortest distance between two points is often not a straight line;
  - the usual orientation, i.e. with what we know as the geographic poles at the top at the bottom, is just as right as any other (although it is handy for navigation to have the top and bottom close to the magnetic poles),

and most relevant for this project,

  - if all the land of the world happened to just be rotated round, but still be in the same position relative to other bits of land, the map would look _very_ different.

## Secondary aims

To experiment with and learn about map projections, 3D transformations, SVG, and real-time low-garbage Javascript in a web-context.

## Some of the code looks like Fortran. Why not use &lt;library or technique&gt;?

To keep garbage to a reasonable minimum to make the transformations, which happen in real time in response to user interaction, as jank-free as possible. If there are better ways to keep garbage low and performance high, ideas are very welcome! Note that ability to profile and reason about the code and then change the code accordingly, is important to acheive high performance, so all things being equal, fewer layers of code is better than more.

## Optimisations Used

A lot of these are based on measurements (in Chrome), but some are based on experience/knowledge/educated guesswork, so may have made things worse.

### Javascript

- For loops used instead of native or library `map` or `reduce`.
- Functions called from inside for loops are defined the same scope as the for loop, i.e. calling `functionName()` rather than `someObject.functionName()`.
- Typed arrays are mutated rather than creating objects or arrays.
- Nested standard arrays are flattened to typed arrays.
- `+=` used instead of array join...
- `+` is used over `+=` where possible
- Use integer SVG coordinates to avoid converting floating points to strings, which is slow, while keeping SVG sub-pixel rendering for small features.

### DOM

- Number of element are minimised. Specifically, a single `path` element is used for the map rather than a `path` element per land mass.
- *Adding/removing elements from the DOM are minimised
- *DOM attribute modification is limited.
- *Hammering layout is avoided, i.e. chains of making modifications to layout, then reading layout.

*These were more important in previous versions when there were multiple `path` elements.

### CSS

- No unused CSS, i.e. no framework
- CSS selectors are kept simple, avoiding (what some think to be) expensive selectors

### Coordinate transformations

- The conversion from latitude/longitude to spherical polar is done once
- The rotation matrix calculated when dragging doesn't use any trigonometric functions, other than to convert the points dragging to cartesian coordinates.

[I would like there to be fewer calls to trigonometic functions, as well as fewer transformations to/from cartesian coordinates.]

## Licences

The content of the `data` directory is derived from data provided by the [NOAA National Geophysical Data Center](http://www.ngdc.noaa.gov/mgg/shorelines/shorelines.html), and is released under the LGPL. The remainder of this project is released under the MIT License.
