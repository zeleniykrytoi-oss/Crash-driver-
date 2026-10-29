# Crash Driver

A soft-body vehicle crash sandbox in a single HTML file, styled after the 2013-era BeamNG.drive tech demos. A pickup truck is simulated as a 4500-node / 565-beam mass-spring network stepped at a fixed 1 ms (1000 Hz). It dents, crumples, bends its suspension and sheds its bumpers, hood and doors when their mounting beams snap.

## Run it

The page is plain HTML plus ES modules from jsDelivr (three.js r160), so any static file server works:

```sh
python3 -m http.server 8000
# open http://localhost:8000/
```

`index.html` is self-contained. When it can fetch `models/gavril_d/scene.glb` it uses that truck. When it can't (for example when opened from `file://`), it builds a procedural placeholder pickup with the same part names and runs the same pipeline. Load another model with `?model=path/to/vehicle.glb` (`.gltf` works too).

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Throttle | W / ↑ | THROTTLE paddle |
| Brake, hold at a stop to reverse | S / ↓ | BRAKE paddle |
| Steer | A D / ← → | ◀ ▶ buttons |
| Reset vehicle | R | RESET VEHICLE |
| Cycle camera (chase, orbit, trackside) | C | CAM |
| f-node debug view | N | F-NODES |
| Slow motion (×0.25) | T | SLOW-MO |
| Orbit camera | drag on the view | drag on the view |

The test bench has a concrete wall 45 m straight ahead of the spawn, a 10° ramp on the left lane and a 22° ramp on the right lane.

## How the engine works

Everything lives in `index.html`, split into numbered sections.

**Fixed step.** Each frame adds real time (times the slow-motion factor) to an accumulator and runs whole 1 ms steps, at most 50 per frame. A slow device gets slow motion instead of a bigger step. The HUD shows the step size and the measured sim rate.

**Nodes** are point masses held in flat `Float64Array`s, integrated with symplectic Euler. There are four kinds:

- **Structural nodes (140):** chassis cross-section rings, plus two-layer lattices for each detachable part.
- **Hub nodes (4):** one per wheel centre.
- **Tread probes (256):** a fixed radial ring of 2 × 32 probes per wheel, used to measure tyre compression.
- **Flexnodes (4100):** sampled over each part's panels, area-weighted and evenly spaced. This fills the matrix to exactly 4500 nodes.

**Beams** (≤ 750) use Hooke's law with linear damping. Past an elastic strain limit the rest length flows plastically, which is permanent deformation. Past a tension or compression strain measured from the factory length, the beam snaps. A Gershgorin bound scales each beam's stiffness and damping so that every node stays stable at 1 ms.

**Flex constraints** bind each flexnode to a tetrahedron of its own part's structural nodes through affine (barycentric) weights. The constraint is a spring-damper to that affine target. Its reaction goes back to the four anchors with the same weights, so momentum and angular momentum are conserved. Beyond about 1 cm of deviation, the flexnode is re-anchored in its deformed tetrahedron, which is how dents form. Flexnodes stay kinematic, costing nothing, until a cluster broadphase sees their region approach the ground, the wall or a ramp. They go back to sleep once they settle.

**Sub-groups.** The truck is partitioned into Chassis, Front Bumper, Rear Bumper, Left Door, Right Door and Hood, using GLTF node names (`hood`, `door_l`, `door_r`, `bumper_f`, `bumper_r`). Each part attaches to the chassis through inter-group beams arranged in brackets (break groups): left/right for the bumpers, left hinge / right hinge / latch for the hood, and hinge / latch for the doors. When enough beams in a bracket snap, the whole bracket fails. When every attachment beam of a part has failed, the part moves into its own simulation context. It keeps deforming and bouncing on its own, and goes to sleep once it comes to rest.

**Wheels.** On load, the stock GLTF wheels, brake discs and hubs are measured and then removed. Each wheel is replaced by:

- **A hub node** on an anisotropic suspension anchor: soft and preloaded along the chassis "up" direction, with progressive bump and droop stops, and stiff laterally. The lateral stiffness yields plastically in crashes, so the suspension bends.
- **A tread-probe ring** that measures tyre compression against the world.
- **A spin state:** angular velocity from drive, brake and tyre torques, with friction coupled implicitly so a stiff tyre can't destabilise the step.

The generated wheel mesh (tyre, steel rim, disc and caliper) rotates by the integrated wheel angle, steers with Ackermann geometry, and squashes radially wherever the probes report compression.

**Rendering.**

- **Skinning:** panel vertices are skinned on the CPU to their three nearest flexnodes, rotated by each flexnode's anchor-tetrahedron frame. Normals are recomputed once a panel is dented.
- **Mechanical parts:** the engine, interior and suspension parts follow tetrahedron frames, and the rear axle follows the line between the rear hubs.
- **Post-processing:** an HDR render goes through UnrealBloom and a Reinhard tone map, then a custom grading pass. The grade adds an amber/sepia cast, over-saturation, lifted blacks, vignette, slight fringing and grain.

## Vehicle model and licence

`models/gavril_d/scene.glb` is "Gavril_D_ Beamng" by [akhikavi7](https://sketchfab.com/akhikavi7), from [Sketchfab](https://sketchfab.com/3d-models/gavril-d--beamng-16aa7bf3a00e4d4fb74edc52fda042f5), licensed CC-BY-4.0 (see `models/gavril_d/license.txt`), repacked losslessly from the original `.gltf` + `.bin` into a single GLB. The in-game HUD shows the same credit.
