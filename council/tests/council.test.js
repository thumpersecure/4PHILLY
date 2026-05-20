import test from 'node:test';
import assert from 'node:assert/strict';
import { pointInPolygon, pointInGeometry, findDistrict } from '../src/geo.js';
import { Cache } from '../src/cache.js';

test('geo: pointInPolygon - point inside simple square', () => {
  const square = [[-75.2, 39.9], [-75.1, 39.9], [-75.1, 40.0], [-75.2, 40.0], [-75.2, 39.9]];
  assert.equal(pointInPolygon([-75.15, 39.95], square), true);
});

test('geo: pointInPolygon - point outside simple square', () => {
  const square = [[-75.2, 39.9], [-75.1, 39.9], [-75.1, 40.0], [-75.2, 40.0], [-75.2, 39.9]];
  assert.equal(pointInPolygon([-75.05, 39.95], square), false);
});

test('geo: pointInPolygon - point on boundary', () => {
  const square = [[-75.2, 39.9], [-75.1, 39.9], [-75.1, 40.0], [-75.2, 40.0], [-75.2, 39.9]];
  // Boundary behavior is implementation-defined, just ensure no crash
  const result = pointInPolygon([-75.2, 39.95], square);
  assert.equal(typeof result, 'boolean');
});

test('geo: pointInGeometry - Polygon type', () => {
  const geometry = {
    type: 'Polygon',
    coordinates: [[[-75.2, 39.9], [-75.1, 39.9], [-75.1, 40.0], [-75.2, 40.0], [-75.2, 39.9]]]
  };
  assert.equal(pointInGeometry([-75.15, 39.95], geometry), true);
  assert.equal(pointInGeometry([-74.9, 39.95], geometry), false);
});

test('geo: pointInGeometry - MultiPolygon type', () => {
  const geometry = {
    type: 'MultiPolygon',
    coordinates: [
      [[[-75.2, 39.9], [-75.1, 39.9], [-75.1, 40.0], [-75.2, 40.0], [-75.2, 39.9]]],
      [[[-75.0, 39.9], [-74.9, 39.9], [-74.9, 40.0], [-75.0, 40.0], [-75.0, 39.9]]]
    ]
  };
  assert.equal(pointInGeometry([-75.15, 39.95], geometry), true);
  assert.equal(pointInGeometry([-74.95, 39.95], geometry), true);
  assert.equal(pointInGeometry([-75.05, 39.95], geometry), false);
});

test('geo: findDistrict - returns correct district number', () => {
  const districts = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { district: 1 },
        geometry: { type: 'Polygon', coordinates: [[[-75.2, 39.9], [-75.15, 39.9], [-75.15, 39.95], [-75.2, 39.95], [-75.2, 39.9]]] }
      },
      {
        type: 'Feature',
        properties: { district: 2 },
        geometry: { type: 'Polygon', coordinates: [[[-75.15, 39.9], [-75.1, 39.9], [-75.1, 39.95], [-75.15, 39.95], [-75.15, 39.9]]] }
      }
    ]
  };
  assert.equal(findDistrict(39.92, -75.17, districts), 1);
  assert.equal(findDistrict(39.92, -75.12, districts), 2);
  assert.equal(findDistrict(40.0, -75.0, districts), null);
});

test('cache: basic set and get', () => {
  const cache = new Cache({ ttl: 1000, maxSize: 10 });
  cache.set('key1', 'value1');
  assert.equal(cache.get('key1'), 'value1');
});

test('cache: returns undefined for missing key', () => {
  const cache = new Cache({ ttl: 1000, maxSize: 10 });
  assert.equal(cache.get('nonexistent'), undefined);
});

test('cache: respects maxSize', () => {
  const cache = new Cache({ ttl: 60000, maxSize: 3 });
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  cache.set('d', 4); // should evict 'a'
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.get('d'), 4);
  assert.equal(cache.size, 3);
});

test('cache: has() works correctly', () => {
  const cache = new Cache({ ttl: 60000, maxSize: 10 });
  cache.set('exists', true);
  assert.equal(cache.has('exists'), true);
  assert.equal(cache.has('nope'), false);
});

test('cache: delete removes entry', () => {
  const cache = new Cache({ ttl: 60000, maxSize: 10 });
  cache.set('key', 'val');
  cache.delete('key');
  assert.equal(cache.get('key'), undefined);
});

test('cache: clear removes all entries', () => {
  const cache = new Cache({ ttl: 60000, maxSize: 10 });
  cache.set('a', 1);
  cache.set('b', 2);
  cache.clear();
  assert.equal(cache.size, 0);
});
