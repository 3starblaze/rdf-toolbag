# RDF Toolbag

## Dev Notes

- "@radix-ui/react-use-controllable-state" is pinned to specific version because it's unstable. Since controllable state is useful to have and reinventing the existing wheel is not worth it, this library has been marked as a direct dependency.
- Added `main": "./dist/rdf-toolbag.js",` in `package.json`, so that this library can be imported locally and the entry point can be found properly.
