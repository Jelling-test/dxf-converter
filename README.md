# DXF Konverter

Lokal webapplikation til konvertering af tekst og billeder til DXF filer.

## Funktioner

- **Tekst til DXF**: Konverter tekst til DXF med single-stroke font (optimeret til CNC/laser)
- **Billede til DXF**: Vektoriser billeder automatisk til DXF format
- **Batch generering**: Generer flere DXF filer på én gang
  - Nummer range (f.eks. husnumre 1-100)
  - Fra tekstfil med separering
  - Manuel liste

## Installation

1. Sørg for at have Node.js installeret (version 18+)

2. Installer alle dependencies:
```bash
npm run install-all
```

## Kørsel

Start både server og frontend på én gang:
```bash
npm run dev
```

Eller start dem separat:
```bash
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
cd client
npm run dev
```

## Brug

1. Åbn browseren på `http://localhost:5173`
2. Vælg konverteringstype (Tekst, Billede eller Batch)
3. Upload/indtast dit indhold
4. Juster indstillinger efter behov
5. Klik konverter og download din DXF fil

## API Endpoints

- `POST /api/convert/text` - Konverter tekst til DXF
- `POST /api/convert/image` - Konverter billede til DXF
- `POST /api/convert/batch` - Batch konvertering til ZIP med multiple DXF filer
- `GET /api/download/:filename` - Download genereret fil

## Teknisk Stack

- **Backend**: Node.js, Express
- **Frontend**: React, TailwindCSS, Vite
- **Billede vektorisering**: Potrace, Sharp
- **DXF generering**: Custom DXF writer

## Eksempel: Husnumre 1-100

1. Gå til "Batch/Numre" fanen
2. Vælg "Nummer Range"
3. Sæt start til 1 og slut til 100
4. Tilføj eventuelt prefix/suffix (f.eks. "Nr. " som prefix)
5. Klik "Generer DXF filer"
6. Download ZIP filen med alle 100 DXF filer
