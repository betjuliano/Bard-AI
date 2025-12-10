# Design Guidelines: Transcrição & Análise Qualitativa SaaS

## Design Approach
**Design System**: Material Design with influences from Linear and Notion for a clean, academic-professional aesthetic. This approach suits the utility-focused nature of research tools while maintaining credibility.

## Typography
- **Primary Font**: Inter or IBM Plex Sans via Google Fonts CDN
- **Monospace**: IBM Plex Mono for file names, technical details, word counts
- **Hierarchy**:
  - Page titles: text-4xl font-bold
  - Section headers: text-2xl font-semibold
  - Subsections: text-lg font-medium
  - Body text: text-base font-normal
  - Metadata/captions: text-sm font-normal
  - Technical labels: text-xs font-medium uppercase tracking-wide

## Layout System
**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, and 12 consistently
- Component padding: p-6 or p-8
- Section spacing: space-y-6 or space-y-8
- Card gaps: gap-4 or gap-6
- Button padding: px-6 py-3

**Container Strategy**:
- Dashboard: max-w-7xl mx-auto px-6
- Reading width (transcriptions): max-w-4xl mx-auto
- Form containers: max-w-2xl mx-auto

## Core Components

### Navigation
Top navigation bar (sticky):
- Logo/brand left
- Primary actions center (Dashboard, Transcrições, Análises)
- User menu + credit indicator right
- Border bottom for separation

### Dashboard Layout
Grid-based layout (grid-cols-1 md:grid-cols-3 gap-6):
- Stats cards showing: Créditos disponíveis, Transcrições realizadas, Análises concluídas
- Recent activity list
- Quick action cards (Nova Transcrição, Nova Análise)

### File Upload Component
Drag-and-drop zone:
- Large dropzone (min-h-64) with dashed border
- Icon (upload cloud) centered
- Supporting text: accepted formats, size limits
- File size progress indicator
- Selected file preview with remove option

### Transcription/Analysis Cards
Card layout with:
- Header: Title + timestamp + status badge
- Metadata row: Duration, word count, file size
- Preview snippet (2-3 lines truncated)
- Action buttons: View, Download, Delete (icon buttons)
- Visual status indicators (pending/processing/completed)

### Credit System Display
Prominent credit counter:
- Large number display (text-3xl font-bold)
- Label "créditos disponíveis"
- "Comprar Créditos" CTA button
- Small text explaining credit value (100 páginas OU 1 análise)

### Analysis Interface
Two-column layout (md:grid-cols-2):
- Left: Transcription text (scrollable, max-h-screen)
- Right: Analysis results with sections:
  - Categorias identificadas
  - Análise de conteúdo
  - Frequência de temas
  - Citações relevantes
- Upload referencial teórico section (file input + preview)

### Payment Modal
Centered modal (max-w-md):
- Clear pricing: R$ 35,00
- Benefits listed (100 páginas transcritas OU 1 análise Bardin)
- Stripe payment form integration
- Security badges

### Library/Archive View
Table or card grid (toggle view):
- Sortable columns: Data, Título, Tipo (Transcrição/Análise), Status
- Filter options: Tipo, Data
- Search bar
- Bulk actions (Download, Delete)

## Component Details

### Buttons
- Primary: Rounded (rounded-md), medium size, semibold text
- Secondary: Outlined variant
- Icon buttons: Square (w-10 h-10), centered icon
- Blurred backgrounds when over images

### Form Inputs
- Rounded corners (rounded-md)
- Clear labels above inputs
- Helper text below when needed
- Error states with icon + message
- File inputs styled as buttons with filename display

### Cards
- Subtle elevation (shadow-sm or shadow-md)
- Rounded corners (rounded-lg)
- Padding: p-6
- Hover state: slight elevation increase

### Status Badges
- Small pill shape (rounded-full px-3 py-1 text-xs)
- Icons + text for clarity
- States: Processando, Concluído, Erro, Aguardando

### Data Display
- Use tables for structured data
- Horizontal dividers between rows
- Icons for file types
- Truncate long text with tooltip on hover

## Animations
Minimal, purposeful only:
- Fade in for modals
- Skeleton loading states for async content
- Smooth transitions for dropdowns/accordions
- NO scroll animations or excessive micro-interactions

## Icons
**Library**: Heroicons via CDN (outline for navigation, solid for emphasis)
- Upload: cloud-arrow-up
- Document: document-text
- Analysis: chart-bar
- Credits: sparkles
- User: user-circle

## Images
No hero image needed. This is a utility dashboard focused on functionality. Use illustrations/icons only for:
- Empty states (upload dropzone, no transcriptions yet)
- Feature explanations in onboarding
- Success/error state illustrations

## Accessibility
- Clear focus states on all interactive elements
- Semantic HTML throughout
- ARIA labels for icon-only buttons
- Sufficient contrast ratios
- Keyboard navigation support
- Screen reader friendly status updates

## Key Design Principles
1. **Academic Credibility**: Clean, professional, no frivolous design elements
2. **Information Hierarchy**: Clear structure for data-heavy interfaces
3. **Efficiency**: Quick access to primary actions (upload, analyze)
4. **Transparency**: Always visible credit balance and usage
5. **Trust**: Secure payment UI, clear data handling messaging