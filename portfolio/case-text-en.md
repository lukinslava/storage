# Little Museum

A home app for the drawings and crafts of two brothers, Kirill and Mark.

## The problem

Kids draw and make things every day. Paper gets lost, crafts break, and photos in the phone's camera roll get buried among everything else. The family needed one place where every piece is kept neatly, with its artist and date, and is a pleasure to look back on.

## The solution

A progressive web app that installs on the iPhone home screen and works like a native app.

- **Drawing:** a parent photographs the sheet on the table. The app finds the paper's edges, corrects the perspective and hangs the drawing in the "museum" in a frame.
- **Figure cut out with scissors:** the app separates it from the table along its outline and saves it with a transparent background.
- **Craft:** photos from four sides. The app is ready to build a 3D model from them (via Meshy).
- Every piece has an artist, a date, a title, a note ("what the artist said") and a collection.

## Screens

- **Museum:** a carousel of works in different frames: wood, tape, pin, mat. The frame is picked from the work's id, so each piece keeps its own frame.
- **Collections:** colored "pockets" with works peeking out.
- **Scan:** capture a drawing or a craft.
- **Story:** a month-by-month timeline, filterable by child.
- **Settings:** the artists and their colors.

## Cutout without neural networks

The background is removed right on the phone, with no servers and no ML models:

1. **Table colors.** k-means on the pixels along the frame edges finds a few table colors: the light and dark wood grain. Objects at the frame edge, like a stack of paper, are ignored.
2. **Background fill.** The background spreads inward from the frame edges through similar colors until it hits a sharp edge: the edge of the paper. That is why a character's skin, close in hue to light wood, is kept.
3. **Outline.** The largest region is kept, and the fuzz along the edge and splinters of table are removed.
4. **Result.** The mask is smoothed and applied to the full-size photo, producing a PNG with transparency.

If the photo shows a rectangular sheet rather than a figure, the app switches to "Sheet" mode on its own. It checks how well the detected shape matches the quadrilateral through its corners. Both modes can be switched by hand, and the cutout has a "gentler / bolder" slider.

## Design

- **Type:** Literata for taglines and artwork titles, for a bookish, gallery feel. Unbounded at light weights for the interface.
- **Color:** a green accent, #417B5A, and six pastel tints for collections and children.
- **Reference:** album apps with pocket cards and frames hung on a wall.

## Stack

- React, TypeScript, Vite, PWA
- Supabase: database, private file storage, access limited to family emails through row-level security (RLS)
- An Edge Function for 3D via Meshy
- model-viewer for 3D and AR
- GitHub Pages
