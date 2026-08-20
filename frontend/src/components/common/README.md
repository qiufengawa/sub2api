# Common domain components

`components/common` contains domain-level components that compose the shared
UI primitives. Generic fields, buttons, dialogs, tables, feedback states and
layout primitives must be imported from `@/components/ui` instead.

The public exports in `index.ts` are limited to live domain components such as
account/group badges and selectors, announcement and locale services, IP
geolocation cells, the image uploader, proxy helpers, and the application
version/subscription summaries.

This boundary keeps business-specific behavior close to its feature while
preventing the old common control wrappers from becoming a second component
library.
