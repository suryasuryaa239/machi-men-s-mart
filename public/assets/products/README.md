# Machii Mens Mart - Product Asset Guide

This directory holds the garment photography used in the hero horizontal rack, the scroll-reveal showcase, and the interactive product viewer.

## Active Transparent PNG Assets (True Alpha Cutouts)

All garment assets are genuine isolated transparent PNG cutouts with true alpha channels. No CSS background removal filters or white rectangle overlays are used.

| Transparent PNG File | Garment Name | View Angle | Specs |
|----------------------|--------------|------------|-------|
| `machii-attitude-01-charcoal.png` | **Machii Essential Oversized Tee** (Attitude 01) | Front | 896x1200, RGBA, 58.1% transparent cutout |
| `machii-attitude-01-back.png` | **Machii Essential Oversized Tee** (Attitude 01) | Back | 896x1200, RGBA, 56.6% transparent cutout |
| `machii-cyber-cobalt.png` | **Midnight Cyber Graphic Tee** | Front | 896x1200, RGBA, 60.5% transparent cutout |
| `machii-retro-cream.png` | **Street Culture Oversized Tee** | Front | 896x1200, RGBA, 52.2% transparent cutout |
| `machii-tokyo-bone.png` | **Retro Energy Print Tee** | Front | 896x1200, RGBA, 56.9% transparent cutout |
| `machii-attitude-hoodie.png` | **Monochrome Statement Hoodie** | Front | 896x1200, RGBA, 54.8% transparent cutout |
| `machii-drop01-sage.png` | **Everyday Heavyweight Vintage Tee** | Front | 896x1200, RGBA, 59.2% transparent cutout |

## 360-Degree Rotation Asset Specification

To support authentic mouse-drag 360° rotation (without fake 2D horizontal flipping, which inverts typography and produces distorted flat artifacts):
1. **Turntable Image Sequence**: 24 or 36 isolated transparent PNG frames shot on an indexed turntable at 15° or 10° increments:
   - `machii-attitude-01-rot-01.png` to `machii-attitude-01-rot-36.png`
2. **3D CAD Mesh**: Or a realtime 3D digital model (`.glb` / `.gltf`) with PBR fabric displacement textures, drape physics, and high-density screenprint normal maps.
3. In the interim, authentic Front & Back view switching is implemented using genuine photographed front and back garment assets.
