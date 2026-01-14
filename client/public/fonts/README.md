# Custom Fonts Directory

Place your custom font files here.

## Supported Formats
- `.woff2` (recommended - best compression)
- `.woff` (good browser support)
- `.ttf` (TrueType)
- `.otf` (OpenType)

## How to Add a Font

1. **Place font files** in this directory (e.g., `MyFont-Regular.woff2`, `MyFont-Bold.woff2`)

2. **Add @font-face declarations** in `/client/src/index.css`:
   ```css
   @font-face {
     font-family: 'MyFont';
     src: url('/fonts/MyFont-Regular.woff2') format('woff2'),
          url('/fonts/MyFont-Regular.woff') format('woff');
     font-weight: normal;
     font-style: normal;
   }
   
   @font-face {
     font-family: 'MyFont';
     src: url('/fonts/MyFont-Bold.woff2') format('woff2'),
          url('/fonts/MyFont-Bold.woff') format('woff');
     font-weight: bold;
     font-style: normal;
   }
   ```

3. **Use the font** in your CSS:
   ```css
   body {
     font-family: 'MyFont', sans-serif;
   }
   ```

## Font Weight Values
- `100` - Thin
- `200` - Extra Light
- `300` - Light
- `400` - Normal (Regular)
- `500` - Medium
- `600` - Semi Bold
- `700` - Bold
- `800` - Extra Bold
- `900` - Black

## Font Style Values
- `normal` - Regular
- `italic` - Italic
- `oblique` - Oblique





