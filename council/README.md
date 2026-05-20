# 4philly-council

Philadelphia City Council district resolution agent. Given a property address or OPA number, resolves the council district and returns councilmember contact information with optional L&I Committee flagging.

## Usage

```js
import { resolveCouncilMember } from './src/index.js';

const result = await resolveCouncilMember({
  propertyAddress: '315 N 12th St',
  issueType: 'rental_license_expired'
});
```

## API

### `resolveCouncilMember(opts)`

- `opts.propertyAddress` — Street address string
- `opts.opaNumber` — OPA parcel number  
- `opts.issueType` — Optional issue type for committee flagging

Returns council district, councilmember contact info, and committee flag.

### `refresh()`

Clears all caches and reloads data from disk.

## Testing

```bash
node --test tests/
```

## Data

- `data/districts.geojson` — Council district boundaries
- `data/councilmembers.json` — Current council roster
- `data/committees.json` — L&I Committee configuration
