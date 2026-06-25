"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { GeoJSONSource, Map as MapboxMap, Marker } from "mapbox-gl";
import type { PeerDot } from "@/lib/types";
import { createMeMarkerEl, createStrangerMarkerEl } from "./markers";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const CONNECTIONS_SOURCE = "pulse-connections";

function connectionFeatures(
  peers: PeerDot[],
  me: { lat: number; lng: number } | null,
  myPeerId: string | null,
) {
  const byId = new Map(peers.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];

  function addLine(
    a: { lng: number; lat: number },
    b: { lng: number; lat: number },
    key: string,
  ) {
    if (seen.has(key)) return;
    seen.add(key);
    features.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [a.lng, a.lat],
          [b.lng, b.lat],
        ],
      },
    });
  }

  for (const p of peers) {
    if (!p.busy || !p.connectedTo) continue;
    const other = byId.get(p.connectedTo);
    if (other) {
      addLine(p, other, [p.id, p.connectedTo].sort().join(":"));
    }
  }

  if (me && myPeerId) {
    const peer = byId.get(myPeerId);
    if (peer?.busy) addLine(me, peer, `me:${myPeerId}`);
  }

  return features;
}

export default function WorldMap({
  peers,
  me,
  meMood,
  myPeerId,
  onPeerClick,
  canConnect,
}: {
  peers: PeerDot[];
  me: { lat: number; lng: number } | null;
  meMood: string | null;
  myPeerId: string | null;
  onPeerClick: (id: string) => void;
  canConnect: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const meMarkerRef = useRef<Marker | null>(null);
  const connectionsReadyRef = useRef(false);
  const [ready, setReady] = useState(false);

  const onPeerClickRef = useRef(onPeerClick);
  const canConnectRef = useRef(canConnect);
  useEffect(() => {
    onPeerClickRef.current = onPeerClick;
    canConnectRef.current = canConnect;
  });

  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    let cancelled = false;
    const markers = markersRef.current;
    const container = containerRef.current;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: me ? [me.lng, me.lat] : [0, 20],
        zoom: me ? 4 : 1.4,
        attributionControl: true,
      });
      map.on("load", () => {
        if (cancelled) return;
        map.addSource(CONNECTIONS_SOURCE, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: CONNECTIONS_SOURCE,
          type: "line",
          source: CONNECTIONS_SOURCE,
          paint: {
            "line-color": "rgba(255, 59, 59, 0.35)",
            "line-width": 1.5,
            "line-dasharray": [2, 3],
          },
        });
        connectionsReadyRef.current = true;
        setReady(true);
      });
      mapRef.current = map;
    })();

    const ro = new ResizeObserver(() => mapRef.current?.resize());
    ro.observe(container);

    return () => {
      cancelled = true;
      ro.disconnect();
      markers.forEach((m) => m.remove());
      markers.clear();
      meMarkerRef.current?.remove();
      meMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      connectionsReadyRef.current = false;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !me) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      if (!meMarkerRef.current) {
        meMarkerRef.current = new mapboxgl.Marker({
          element: createMeMarkerEl(meMood),
        })
          .setLngLat([me.lng, me.lat])
          .addTo(map);
      } else {
        meMarkerRef.current.setLngLat([me.lng, me.lat]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me, meMood, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      const markers = markersRef.current;
      const seen = new Set<string>();

      for (const peer of peers) {
        seen.add(peer.id);
        let marker = markers.get(peer.id);
        if (!marker) {
          const el = createStrangerMarkerEl(peer.mood);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            if (canConnectRef.current) onPeerClickRef.current(peer.id);
          });
          marker = new mapboxgl.Marker({ element: el })
            .setLngLat([peer.lng, peer.lat])
            .addTo(map);
          markers.set(peer.id, marker);
        } else {
          marker.setLngLat([peer.lng, peer.lat]);
        }
        marker.getElement().style.opacity = peer.busy ? "0.3" : "";
      }

      for (const [id, marker] of markers) {
        if (!seen.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [peers, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !connectionsReadyRef.current) return;
    const source = map.getSource(CONNECTIONS_SOURCE) as GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: "FeatureCollection",
      features: connectionFeatures(peers, me, myPeerId),
    });
  }, [peers, me, myPeerId, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full bg-[#080808]" />

      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(8,8,8,0.5) 100%)",
        }}
      />

      {!TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="max-w-md border border-[#1f1f1f] bg-[#111111] p-4 text-sm text-[#5a5a5a]">
            Set{" "}
            <code className="text-[#f0f0f0]">NEXT_PUBLIC_MAPBOX_TOKEN</code> in{" "}
            <code>.env</code> to load the map.
          </p>
        </div>
      )}
    </div>
  );
}
