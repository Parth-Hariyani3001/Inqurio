"""Generate docs/inquiro-design.pdf -- Inquiro visual design reference."""

from pathlib import Path

from reportlab.lib.colors import Color, white
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    CondPageBreak,
    Flowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT = Path(__file__).resolve().parents[2] / "docs" / "inquiro-design.pdf"

PAPER = Color(0.965, 0.961, 0.945)
INK = Color(0.18, 0.16, 0.13)
MUTED = Color(0.42, 0.40, 0.36)
GREEN = Color(0.18, 0.38, 0.30)
GREEN_PALE = Color(0.88, 0.92, 0.88)
RULE = Color(0.78, 0.76, 0.70)
CARD = Color(0.99, 0.99, 0.98)


def heading_styles():
    base = getSampleStyleSheet()
    styles = {
        "cover_kicker": ParagraphStyle(
            "cover_kicker",
            parent=base["Normal"],
            fontName="Times-Italic",
            fontSize=11,
            textColor=GREEN,
            tracking=1.2,
            spaceAfter=8,
        ),
        "cover_title": ParagraphStyle(
            "cover_title",
            parent=base["Normal"],
            fontName="Times-Bold",
            fontSize=34,
            leading=40,
            textColor=INK,
            spaceAfter=12,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=12,
            leading=18,
            textColor=MUTED,
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=base["Normal"],
            fontName="Times-Bold",
            fontSize=20,
            leading=24,
            textColor=INK,
            spaceBefore=4,
            spaceAfter=10,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Normal"],
            fontName="Times-Bold",
            fontSize=13.5,
            leading=17,
            textColor=GREEN,
            spaceBefore=12,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=14,
            textColor=INK,
            spaceAfter=8,
        ),
        "muted": ParagraphStyle(
            "muted",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=MUTED,
            spaceAfter=6,
        ),
        "caption": ParagraphStyle(
            "caption",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=MUTED,
            spaceBefore=2,
            spaceAfter=10,
        ),
        "cell": ParagraphStyle(
            "cell",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=12,
            textColor=INK,
        ),
        "cell_head": ParagraphStyle(
            "cell_head",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=11,
            textColor=white,
        ),
        "mono": ParagraphStyle(
            "mono",
            parent=base["Normal"],
            fontName="Courier",
            fontSize=8,
            leading=11,
            textColor=INK,
        ),
        "quote": ParagraphStyle(
            "quote",
            parent=base["Normal"],
            fontName="Times-Italic",
            fontSize=12,
            leading=17,
            textColor=INK,
            leftIndent=10,
            spaceBefore=4,
            spaceAfter=4,
        ),
        "li": ParagraphStyle(
            "li",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13.5,
            textColor=INK,
        ),
    }
    return styles


class HRule(Flowable):
    def __init__(self, color=RULE, thickness=0.4, space=8):
        super().__init__()
        self.color = color
        self.thickness = thickness
        self.space = space
        self.height = space

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, self.space / 2, self.width, self.space / 2)


class BoxesRow(Flowable):
    """Simple labeled boxes in a row, optionally connected."""

    def __init__(self, labels, width=170 * mm, height=18 * mm, connected=True):
        super().__init__()
        self.labels = labels
        self.box_h = height
        self._w = width
        self.connected = connected
        self.height = height + 4
        self.width = width

    def wrap(self, aw, ah):
        self.width = aw
        return aw, self.height

    def draw(self):
        n = len(self.labels)
        gap = 10 if self.connected else 8
        bw = (self.width - gap * (n - 1)) / n
        c = self.canv
        for i, label in enumerate(self.labels):
            x = i * (bw + gap)
            c.setFillColor(CARD)
            c.setStrokeColor(GREEN)
            c.setLineWidth(0.8)
            c.roundRect(x, 2, bw, self.box_h, 3, fill=1, stroke=1)
            c.setFillColor(INK)
            c.setFont("Times-Bold", 10)
            c.drawCentredString(x + bw / 2, 2 + self.box_h / 2 - 3, label)
            if self.connected and i < n - 1:
                c.setStrokeColor(GREEN)
                c.setLineWidth(0.9)
                y = 2 + self.box_h / 2
                c.line(x + bw, y, x + bw + gap, y)
                c.line(x + bw + gap - 3, y + 2.5, x + bw + gap, y)
                c.line(x + bw + gap - 3, y - 2.5, x + bw + gap, y)


class TwoColBoxes(Flowable):
    def __init__(self, left, right, left_title, right_title):
        super().__init__()
        self.left = left
        self.right = right
        self.left_title = left_title
        self.right_title = right_title
        self.height = 52 * mm

    def wrap(self, aw, ah):
        self.width = aw
        return aw, self.height

    def draw(self):
        c = self.canv
        w = (self.width - 12) / 2
        h = self.height
        for i, (title, items) in enumerate(
            ((self.left_title, self.left), (self.right_title, self.right))
        ):
            x = i * (w + 12)
            c.setFillColor(GREEN_PALE if i == 0 else CARD)
            c.setStrokeColor(GREEN)
            c.setLineWidth(0.7)
            c.roundRect(x, 0, w, h, 3, fill=1, stroke=1)
            c.setFillColor(GREEN)
            c.setFont("Helvetica-Bold", 8)
            c.drawString(x + 8, h - 14, title.upper())
            c.setFillColor(INK)
            c.setFont("Times-Roman", 10)
            y = h - 30
            for item in items:
                c.drawString(x + 8, y, item)
                y -= 14


class StackBoxes(Flowable):
    def __init__(self, labels):
        super().__init__()
        self.labels = labels
        self.height = len(labels) * 16 + 4

    def wrap(self, aw, ah):
        self.width = aw
        return aw, self.height

    def draw(self):
        c = self.canv
        for i, label in enumerate(self.labels):
            y = self.height - (i + 1) * 16
            c.setFillColor(CARD)
            c.setStrokeColor(RULE)
            c.setLineWidth(0.6)
            c.roundRect(0, y, self.width, 14, 2, fill=1, stroke=1)
            c.setFillColor(INK)
            c.setFont("Helvetica", 8.5)
            c.drawString(8, y + 4, label)
            if i < len(self.labels) - 1:
                c.setStrokeColor(GREEN)
                c.setLineWidth(0.7)
                mid = self.width / 2
                c.line(mid, y, mid, y - 2)


def table(headers, rows, col_widths, styles):
    head = [Paragraph(h, styles["cell_head"]) for h in headers]
    data = [head]
    for row in rows:
        data.append([Paragraph(c, styles["cell"]) for c in row])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), GREEN),
                ("TEXTCOLOR", (0, 0), (-1, 0), white),
                ("BACKGROUND", (0, 1), (-1, -1), CARD),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("GRID", (0, 0), (-1, -1), 0.3, RULE),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ]
        )
    )
    return t


def bullets(items, styles):
    return ListFlowable(
        [
            ListItem(Paragraph(i, styles["li"]), leftIndent=12, bulletColor=GREEN)
            for i in items
        ],
        bulletType="bullet",
        start="-",
        leftIndent=14,
        bulletFontName="Helvetica",
        bulletFontSize=9,
        spaceBefore=2,
        spaceAfter=8,
    )


def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.setStrokeColor(GREEN)
    canvas.setLineWidth(2.2)
    canvas.line(18 * mm, A4[1] - 12 * mm, A4[0] - 18 * mm, A4[1] - 12 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(18 * mm, A4[1] - 10 * mm, "Inquiro  ·  Design reference")
    canvas.drawRightString(A4[0] - 18 * mm, A4[1] - 10 * mm, "Reading room")
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.4)
    canvas.line(18 * mm, 14 * mm, A4[0] - 18 * mm, 14 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(18 * mm, 9 * mm, "Keep this file with the repo. Tokens live in src/styles.css.")
    canvas.drawRightString(A4[0] - 18 * mm, 9 * mm, str(doc.page))
    canvas.restoreState()


def on_cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.setFillColor(GREEN)
    canvas.rect(0, 0, 10 * mm, A4[1], fill=1, stroke=0)
    canvas.setStrokeColor(GREEN)
    canvas.setLineWidth(0.6)
    canvas.line(18 * mm, 28 * mm, A4[0] - 18 * mm, 28 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(18 * mm, 18 * mm, "Inquiro frontend  ·  docs/inquiro-design.pdf")
    canvas.restoreState()


def build():
    styles = heading_styles()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        title="Inquiro Design Reference",
        author="Inquiro",
        subject="Visual design principles, tokens, and maintenance checklist",
    )

    story = []

    # Cover
    story.append(Spacer(1, 38 * mm))
    story.append(Paragraph("A reading room for papers", styles["cover_kicker"]))
    story.append(Paragraph("Inquiro<br/>design reference", styles["cover_title"]))
    story.append(
        Paragraph(
            "Principles, color and type tokens, page composition, and a checklist "
            "for keeping the product visually consistent as you build the library, "
            "reader, and question flow.",
            styles["cover_sub"],
        )
    )
    story.append(Spacer(1, 16 * mm))
    story.append(HRule(GREEN, 1.2, 10))
    story.append(
        Paragraph(
            "The look comes from a small set of rules applied everywhere, not from "
            "extra components. Treat Inquiro as a reading room (paper, ink, margin "
            "notes), not as a SaaS landing kit.",
            styles["body"],
        )
    )
    story.append(
        Paragraph(
            "Signature of the system: a typeset excerpt, a highlighted passage, "
            "and a question in the margin.",
            styles["muted"],
        )
    )
    story.append(PageBreak())

    # 1 Metaphor
    story.append(Paragraph("1. Product metaphor", styles["h1"]))
    story.append(
        Paragraph(
            "The product is find a paper, read it, and ask about a passage. "
            "The UI should look like that, not like a marketing site.",
            styles["body"],
        )
    )
    story.append(BoxesRow(["Find", "Read", "Ask"]))
    story.append(
        Paragraph(
            "Map those verbs onto artifacts: catalog, typeset page, margin note.",
            styles["caption"],
        )
    )
    story.append(Paragraph("Landing vs app", styles["h2"]))
    story.append(
        TwoColBoxes(
            ["Excerpt (sample paper)", "Highlight on a passage", "Margin question"],
            ["Paper canvas / PDF", "Text selection", "Ask thread on the selection"],
            "Landing metaphor",
            "Product you should build",
        )
    )
    story.append(
        Paragraph(
            "Landing shows the full excerpt. Auth only quotes the question so the "
            "pages feel related without repeating the composition.",
            styles["caption"],
        )
    )

    # 2 Why pretty
    story.append(Paragraph("2. Why it reads as considered", styles["h1"]))
    story.append(
        Paragraph(
            "Quiet contrast, one accent, and type that matches the subject. "
            "Pretty here means restraint, not decoration.",
            styles["body"],
        )
    )
    story.append(
        table(
            ["Avoided", "Replaced with"],
            [
                [
                    "Gradient wordmark, giant hero type",
                    "Serif headline at a human size (about 4xl / 5xl)",
                ],
                [
                    "Blue glow, glass, 2rem pills",
                    "Hairline borders, radius 0.4rem",
                ],
                [
                    "Three feature cards, badges, icons",
                    "One sequence: Find / Read / Ask",
                ],
                [
                    "Placeholder marketing copy",
                    "Copy about reading and asking the paper",
                ],
                [
                    "Floating Clerk card on a glow",
                    "Split layout, transparent Clerk chrome",
                ],
            ],
            [80 * mm, 94 * mm],
            styles,
        )
    )
    story.append(Spacer(1, 6 * mm))

    # 3 Principles
    story.append(Paragraph("3. Design principles", styles["h1"]))
    principles = [
        (
            "One signature, everything else quiet",
            "The excerpt plus margin question is the showpiece. Headers, buttons, "
            "and auth must not compete with it.",
        ),
        (
            "Show the product, do not describe it",
            "Prefer a real artifact (page, highlight, citation) over a stock icon grid.",
        ),
        (
            "Type carries personality",
            "Serif for titles and paper body. Geist / sans for chrome and buttons. "
            "Mono for identifiers (arXiv ids).",
        ),
        (
            "Semantic color only",
            "Use background, foreground, muted-foreground, primary, accent, border. "
            "Do not add raw Tailwind blues, purples, or a second brand green.",
        ),
        (
            "Structure with rules, not cards",
            "Separator and hairline borders are the journal language. A card is for "
            "a discrete object (a paper in a list), not for every section.",
        ),
        (
            "Hierarchy is vertical, not louder",
            "Kicker, then serif title, then muted body, then one primary button. "
            "Do not enlarge type or add a badge to create emphasis.",
        ),
        (
            "Motion is optional",
            "Opacity on hover is enough. No looping gradients or spring glows. "
            "Respect prefers-reduced-motion.",
        ),
        (
            "Copy is interface",
            "Verbs: Find, Read, Ask, Create account, Sign in. No unlock / "
            "revolutionize / AI-powered.",
        ),
    ]
    for title, body in principles:
        story.append(Paragraph(title, styles["h2"]))
        story.append(Paragraph(body, styles["body"]))

    story.append(PageBreak())

    # 4 Tokens
    story.append(Paragraph("4. Tokens (source of truth)", styles["h1"]))
    story.append(
        Paragraph(
            "Defined in src/styles.css under :root and .dark. Change tokens there. "
            "Do not restyle pages one-off.",
            styles["body"],
        )
    )
    story.append(Paragraph("Color roles", styles["h2"]))
    story.append(
        table(
            ["Token", "Role", "Do not"],
            [
                [
                    "background / foreground",
                    "Page and body text (archival stone + ink)",
                    "Use a second off-white or near-black",
                ],
                [
                    "primary",
                    "The one action (Create account)",
                    "Fill large surfaces with green",
                ],
                [
                    "accent",
                    "Selected passage (mark / highlight)",
                    "Use as a second brand color for buttons",
                ],
                [
                    "muted-foreground",
                    "Captions, kickers, secondary sentences",
                    "Use for primary body copy",
                ],
                [
                    "border",
                    "Structure: 1px rules instead of shadows",
                    "Replace with shadow-xl or glass",
                ],
            ],
            [42 * mm, 68 * mm, 64 * mm],
            styles,
        )
    )
    story.append(Paragraph("Approximate light values (oklch in CSS)", styles["h2"]))
    story.append(
        table(
            ["Token", "oklch", "Intent"],
            [
                ["background", "0.978 0.005 102", "Uncoated archival paper"],
                ["foreground", "0.235 0.018 52", "Ink"],
                ["primary", "0.355 0.058 155", "Binding-cloth green"],
                ["accent", "pale green wash", "Highlight, not CTA"],
                ["radius", "0.4rem", "Tight corners, not pills"],
            ],
            [40 * mm, 52 * mm, 82 * mm],
            styles,
        )
    )
    story.append(Paragraph("Type", styles["h2"]))
    story.append(
        table(
            ["Role", "Face", "Use for"],
            [
                ["font-serif / font-display", "Source Serif 4", "Titles, paper body, pull quotes"],
                ["font-sans", "Geist Variable", "Nav, buttons, helper text"],
                ["font-mono", "Geist / Menlo", "Identifiers such as arXiv:2403.11208"],
            ],
            [50 * mm, 42 * mm, 82 * mm],
            styles,
        )
    )
    story.append(
        Paragraph(
            "Do not set marketing headlines in Geist. Do not set navigation in serif.",
            styles["caption"],
        )
    )

    # 5 Hierarchy
    story.append(Paragraph("5. Information hierarchy", styles["h1"]))
    story.append(
        Paragraph(
            "Reuse this stack on every new screen before inventing layout chrome.",
            styles["body"],
        )
    )
    story.append(
        StackBoxes(
            [
                "1  Kicker  —  small, muted, wide tracking",
                "2  Title  —  serif, tight tracking",
                "3  Body  —  sans, muted, max about 28-32rem",
                "4  Actions  —  one primary, rest ghost",
                "5  Meta  —  mono or extra-small muted",
            ]
        )
    )
    story.append(
        Paragraph(
            "Already used on: landing hero, auth aside, paper excerpt "
            "(journal label, title, authors, body, question label).",
            styles["caption"],
        )
    )

    story.append(PageBreak())

    # 6 Landing
    story.append(Paragraph("6. Landing composition", styles["h1"]))
    story.append(
        Paragraph(
            "Files: navbar.tsx, hero.tsx, paper-excerpt.tsx, site-footer.tsx. "
            "Content width: max-w-6xl.",
            styles["muted"],
        )
    )
    story.append(
        StackBoxes(
            [
                "Header: Logo  |  theme, Sign in (ghost), Create account (primary)",
                "Hero left: kicker, serif H1, one paragraph, CTAs",
                "Hero right: PaperExcerpt (page + highlight + margin Q)",
                "Separator",
                "How you work: Find / Read / Ask as a list, not cards",
                "Separator",
                "Close: one sentence + Create account",
                "Footer colophon",
            ]
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("Headline to protect", styles["h2"]))
    story.append(Paragraph("Read the paper. Ask it back.", styles["quote"]))
    story.append(
        Paragraph(
            "Primary action is Create account. Sign in stays ghost / secondary.",
            styles["body"],
        )
    )

    # 7 Auth
    story.append(Paragraph("7. Sign in and sign up", styles["h1"]))
    story.append(
        Paragraph(
            "Shared shell: src/routes/_auth/route.tsx. Clerk widgets in "
            "sign-in/$.tsx and sign-up/$.tsx. Appearance: "
            "src/integrations/clerk/provider.tsx (no card shadow, radius 0.4rem).",
            styles["body"],
        )
    )
    story.append(
        TwoColBoxes(
            [
                "Logo",
                "Same kicker language",
                "Serif line: Keep the argument...",
                "Pull-quote from the excerpt",
            ],
            [
                "Home (lg+) or Logo (mobile)",
                "Theme toggle",
                "Clerk form, max-w-md",
                "Skeleton while Clerk loads",
            ],
            "Desktop aside (lg+)",
            "Form column",
        )
    )
    story.append(
        Paragraph(
            "On small screens the aside hides. Do not wrap Clerk in another card.",
            styles["caption"],
        )
    )

    # 8 Files
    story.append(Paragraph("8. Where to change what", styles["h1"]))
    story.append(
        table(
            ["Layer", "Path", "You may change"],
            [
                ["Color, radius, fonts, shadows", "src/styles.css", "Tokens only"],
                ["Buttons, sheet, separator", "src/components/ui/*", "Variants, not one-off colors"],
                ["Brand chrome", "logo, navbar, site-footer", "Keep shared across pages"],
                ["Product metaphor", "paper-excerpt.tsx", "Evolve into the real reader"],
                ["Auth skin", "clerk provider + _auth/route", "Keep Clerk unboxed"],
            ],
            [48 * mm, 58 * mm, 68 * mm],
            styles,
        )
    )

    story.append(PageBreak())

    # 9 Checklist
    story.append(Paragraph("9. Checklist for a new screen", styles["h1"]))
    story.append(
        Paragraph(
            "When adding a route, copy hierarchy and tokens, not a whole landing section.",
            styles["body"],
        )
    )
    story.append(
        bullets(
            [
                "Does this screen need a new visual idea? Usually no. Reuse kicker / serif title / muted body / hairline / one primary button.",
                "Is there a real object? Paper row, PDF canvas, highlight, citation: yes. Empty gradient panel: no.",
                "Colors: only semantic tokens. New meaning (e.g. saved) gets a token in styles.css, not text-emerald-600.",
                "Type: titles font-serif, UI font-sans, ids font-mono.",
                "Cards: only if the thing is a list item or a contained document. Page sections get Separator.",
                "CTAs: one primary per view. Sign in stays ghost.",
                "Width: marketing max-w-6xl; reading column about 65-72ch; forms max-w-md.",
                "Dark mode: restyle via tokens. Avoid scattering dark: color overrides.",
                "shadcn: compose Button, Separator, Sheet, Skeleton. Do not import a glass / purple dashboard kit.",
                "Motion: none, or opacity/translate on interaction. No ambient loops.",
            ],
            styles,
        )
    )

    story.append(Paragraph("10. Drift to watch for", styles["h1"]))
    story.append(
        bullets(
            [
                "rounded-3xl, shadow-xl, or bg-gradient-to-* on new pages",
                "Inter or Bricolage Grotesque sneaking back in for titles",
                "Primary used as a large background",
                "Icon + title + paragraph grids of three",
                "Clerk (or any vendor) reintroducing a heavy card -- override in clerkAppearance",
                "Two display typefaces on one page",
            ],
            styles,
        )
    )

    story.append(Paragraph("11. Building the reader", styles["h1"]))
    story.append(
        Paragraph(
            "Keep the reader calm: high-readability body, accent only on the active "
            "highlight, questions as a narrow margin or sidebar -- not a consumer "
            "chat-bubble stack.",
            styles["body"],
        )
    )
    story.append(BoxesRow(["Paper canvas", "Selection", "Ask thread"], connected=True))
    story.append(
        Paragraph(
            "If a library page looks like the marketing hero, it is too loud. "
            "If the reader looks like the auth form, it is too sparse: give the "
            "paper the width and the question the margin.",
            styles["caption"],
        )
    )

    story.append(HRule(GREEN, 1.0, 12))
    story.append(Paragraph("Working widths and components", styles["h2"]))
    story.append(
        table(
            ["Context", "Width / component"],
            [
                ["Site header / landing sections", "max-w-6xl, hairline border-b"],
                ["Reading column", "prose measure, roughly 65-72 characters"],
                ["Auth form", "max-w-md, Clerk unboxed"],
                ["Section breaks", "Separator, not Card"],
                ["Loading Clerk", "Skeleton in auth-form-fallback.tsx"],
                ["Buttons", "buttonVariants: default primary, ghost secondary"],
            ],
            [70 * mm, 104 * mm],
            styles,
        )
    )
    story.append(Spacer(1, 8 * mm))
    story.append(
        Paragraph(
            "If this file and the running UI disagree, the running UI plus "
            "src/styles.css win -- then update this PDF.",
            styles["muted"],
        )
    )

    def first_page(c, d):
        on_cover(c, d)

    def later(c, d):
        on_page(c, d)

    doc.build(story, onFirstPage=first_page, onLaterPages=later)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    build()
