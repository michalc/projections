# projections [![Build Status](https://travis-ci.org/michalc/projections.svg?branch=master)](https://travis-ci.org/michalc/projections) [![codecov](https://codecov.io/gh/michalc/projections/branch/master/graph/badge.svg)](https://codecov.io/gh/michalc/projections)

Source for http://projections.charemza.name/

## What does this do?

By dragging a point on the map, the world is rotated before the (spherical) Mercator projection is applied.

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

To keep garbage to a reasonable minimum to make the transformations, which happen in real time in response to user interaction, as jank-free as possible. This often means

  - avoiding creating new objects;
  - avoiding creating new arrays;
  - mutating typed arrays.

If there are better ways to keep garbage low and performance high, ideas are very welcome!

## Licences

The content of the `data` directory is derived from data provided by the [NOAA National Geophysical Data Center](http://www.ngdc.noaa.gov/mgg/shorelines/shorelines.html), and is released under the LGPL. The remainder of this project is released under the MIT License.
