#!/usr/bin/env python3
"""
Renders the CV pages from one data file.

  assets/data/cv.json  ->  cv/index.html (English) and sv/cv/index.html (Swedish)

The PDFs in assets/cv/ are the finished iOS CVs, copied in as they are; keep
cv.json in step with them. The HTML template lives in this file; the CV content
lives only in cv.json. Stdlib only.

Run from anywhere:  python3 tools/build-cv.py
"""

import datetime
import html
import json
import os
import re
from string import Template

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "assets", "data", "cv.json")
SITE = "https://antonsmedberg.github.io"
PERSON_ID = SITE + "/#anton"
SOURCE = "https://github.com/antonsmedberg/antonsmedberg.github.io"

# Chrome and labels per language. The CV content itself is in cv.json.
PAGES = {
    "en": {
        "path": "cv/index.html",
        "url": "/cv/",
        "other": "/sv/cv/",
        "other_lang": "sv",
        "home": "/",
        "job_title": "iOS Developer",
        "og_alt": "Anton Smedberg, junior developer in iOS, Android and Java. His name beside a pixel-art Turning Torso at dusk, with the mascot Bit waving.",
        "pdf": "/assets/cv/Anton-Smedberg-CV.pdf",
        "locale": "en_GB",
        "in_language": "en-GB",
        "title": "CV, Anton Smedberg",
        "description": "CV of Anton Smedberg, iOS developer in Malmö with a focus on UI and UX: internships at Axis Communications and Weavy, and my own apps in Swift and SwiftUI. Also as a PDF.",
        "skip": "Skip to content",
        "brand": "Anton Smedberg, home",
        "status": "Open to junior roles",
        "lang_label": "SV", "lang_name": "Svenska",
        "theme": "Theme: automatic. Switch to light",
        "download": "Download PDF",
        "pdf_other": "/assets/cv/Anton-Smedberg-CV-SV.pdf",
        "download_other": "PDF in Swedish",
        "print": "Print",
        "index": "Sections of the CV",
        "index_items": [("profile", "Summary"), ("experience", "Experience"), ("projects", "Projects"), ("education", "Education"), ("skills", "Skills")],
        "tools": "Language and theme",
        # Skill groups in cv.json by track; a group named nowhere joins the last track.
        "tracks": [("iOS", ["iOS", "Testing", "Architecture", "Performance & debugging", "Graphics & AI", "Accessibility"]), ("Android", ["Android"]), ("Java and backend", ["Backend"]), ("Tools and languages", [])],
        "headings": {"profile": "Summary", "experience": "Experience", "projects": "Projects", "education": "Education", "courses": "Courses (Higher Vocational Education)", "skills": "Skills", "other": "Other experience", "achievements": "Other achievements"},
        "tech": "Tech",
        "updated": "Updated",
        "colophon": "Set in Bricolage Grotesque, the system font and Inter, served from this site. This page is generated from assets/data/cv.json by tools/build-cv.py.",
        "pdf_label": "CV (PDF)",
        "source": "Source",
        "tab_label": "Sections",
        "tabs": [("Home", "/", "t-home"), ("Work", "/#work", "t-work"), ("CV", "/cv/", "t-cv"), ("Contact", "/#contact", "t-mail")],
    },
    "sv": {
        "path": "sv/cv/index.html",
        "url": "/sv/cv/",
        "other": "/cv/",
        "other_lang": "en",
        "home": "/sv/",
        "job_title": "iOS-utvecklare",
        "og_alt": "Anton Smedberg, juniorutvecklare inom iOS, Android och Java. Namnet står bredvid Turning Torso i pixelgrafik i skymningen, och maskoten Bit vinkar.",
        "pdf": "/assets/cv/Anton-Smedberg-CV-SV.pdf",
        "locale": "sv_SE",
        "in_language": "sv-SE",
        "title": "CV, Anton Smedberg (svenska)",
        "description": "CV för Anton Smedberg, iOS-utvecklare i Malmö med fokus på UI och UX: LIA på Axis Communications och Weavy och egna appar i Swift och SwiftUI. Även som PDF.",
        "skip": "Hoppa till innehåll",
        "brand": "Anton Smedberg, startsida",
        "status": "Söker juniorroll",
        "lang_label": "EN", "lang_name": "English",
        "theme": "Tema: automatiskt. Byt till ljust",
        "download": "Ladda ner PDF",
        "pdf_other": "/assets/cv/Anton-Smedberg-CV.pdf",
        "download_other": "PDF på engelska",
        "print": "Skriv ut",
        "index": "CV:ts avsnitt",
        "index_items": [("profile", "Profil"), ("experience", "Erfarenhet"), ("projects", "Projekt"), ("education", "Utbildning"), ("skills", "Kompetenser")],
        "tools": "Språk och tema",
        "tracks": [("iOS", ["iOS", "Test", "Arkitektur", "Prestanda och felsökning", "Grafik och AI", "Tillgänglighet"]), ("Android", ["Android"]), ("Java och backend", ["Backend"]), ("Verktyg och språk", [])],
        "headings": {"profile": "Profil", "experience": "Arbetslivserfarenhet", "projects": "Projekt", "education": "Utbildning", "courses": "Kurser (yrkeshögskola)", "skills": "Kompetenser", "other": "Övrig arbetslivserfarenhet", "achievements": "Övriga meriter"},
        "tech": "Teknik",
        "updated": "Uppdaterad",
        "colophon": "Satt i Bricolage Grotesque, systemets typsnitt och Inter, som serveras från den här webbplatsen. Sidan genereras från assets/data/cv.json av tools/build-cv.py.",
        "pdf_label": "CV (PDF)",
        "source": "Källkod",
        "tab_label": "Avsnitt",
        "tabs": [("Hem", "/sv/", "t-home"), ("Projekt", "/sv/#work", "t-work"), ("CV", "/sv/cv/", "t-cv"), ("Kontakt", "/sv/#contact", "t-mail")],
    },
}

SPRITE = "/assets/img/icons.svg"
MARK = '<svg class="mark" aria-hidden="true"><use href="/assets/img/icons.svg#i-mark"/></svg>'

# The sections that have a mark of their own in the index: the same pictures that head them on the home page.
PAGE = Template("""<!DOCTYPE html>
<html lang="$lang" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>$title</title>
<meta name="description" content="$description">
<meta name="author" content="Anton Smedberg">
<meta name="robots" content="index,follow">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f4f5f7">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b0d11">
<link rel="canonical" href="$site$url">
<link rel="alternate" hreflang="en" href="$site/cv/">
<link rel="alternate" hreflang="sv" href="$site/sv/cv/">
<link rel="alternate" hreflang="x-default" href="$site/cv/">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/img/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="Anton Smedberg">
<meta property="og:title" content="$title">
<meta property="og:description" content="$description">
<meta property="og:url" content="$site$url">
<meta property="og:image" content="$site/assets/img/og-image.jpg">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="$og_alt">
<meta property="og:locale" content="$locale">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="$title">
<meta name="twitter:description" content="$description">
<meta name="twitter:image" content="$site/assets/img/og-image.jpg">
<script>try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}</script>
<link rel="stylesheet" href="/assets/css/style.css">
<link rel="stylesheet" href="/assets/css/cv.css">
<script type="speculationrules">{"prefetch":[{"where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":"/assets/*"}}]},"eagerness":"moderate"}]}</script>
<script type="application/ld+json">
$jsonld
</script>
</head>
<body>
<div class="screen">
<a class="skip-link" href="#main">$skip</a>
<header class="masthead">
  <div class="shell masthead__inner">
    <a class="brand" href="$home" aria-label="$brand"><span class="island__pill glass" aria-hidden="true"></span>$mark<span class="island__text"><b>Anton Smedberg</b><small>$status<i class="island__dot" aria-hidden="true"></i></small></span></a>
    <div class="tools glass" role="group" aria-label="$tools">
      <a class="tool tool--lang" href="$other" hreflang="$other_lang" lang="$other_lang" aria-label="$lang_name"><svg aria-hidden="true"><use href="$sprite#i-globe"/></svg>$lang_label</a>
      <button class="tool theme" type="button" data-theme-toggle aria-label="$theme"><svg class="i-auto" aria-hidden="true"><use href="$sprite#i-auto"/></svg><svg class="i-sun" aria-hidden="true"><use href="$sprite#i-sun"/></svg><svg class="i-moon" aria-hidden="true"><use href="$sprite#i-moon"/></svg></button>
    </div>
  </div>
</header>

<main id="main" tabindex="-1">
<article class="cv shell" aria-labelledby="cv-name">
  <header class="cv__head">
    <h1 class="cv__name" id="cv-name">$name</h1>
    <p class="cv__role">$role</p>
    <p class="cv__keys">$keywords</p>
    $contact
    <p class="avail cv__avail"><i aria-hidden="true"></i><span>$availability</span></p>
    <div class="actions">
      <a class="btn" href="$pdf" download><svg class="icon" aria-hidden="true"><use href="$sprite#i-download"/></svg>$download</a>
      <a class="btn btn--quiet" href="$pdf_other" download hreflang="$other_lang"><svg class="icon" aria-hidden="true"><use href="$sprite#i-download"/></svg>$download_other</a>
      <button class="btn btn--quiet" type="button" data-print><svg class="icon" aria-hidden="true"><use href="$sprite#i-doc"/></svg>$print</button>
    </div>
  </header>

  <nav class="cv__index glass" aria-label="$index">$index_links</nav>

  <div class="cv__cols">
  <div class="cv__main">
  <section class="cv__section panel" data-sec="profile" aria-labelledby="cv-profile">
    <h2 id="cv-profile">$h_profile</h2>
    <p class="cv__profile">$profile</p>
  </section>

  <section class="cv__section panel" data-sec="experience" aria-labelledby="cv-experience">
    <h2 id="cv-experience">$h_experience</h2>
    <div class="cv__timeline">
    $experience
    </div>
  </section>

  <section class="cv__section panel" data-sec="projects" aria-labelledby="cv-projects">
    <h2 id="cv-projects">$h_projects</h2>
    $projects
  </section>

  </div>
  <div class="cv__side">
  <section class="cv__section panel" data-sec="education" aria-labelledby="cv-education">
    <h2 id="cv-education">$h_education</h2>
    <div class="cv__timeline">
    $education
    </div>
  </section>

  <section class="cv__section panel" data-sec="courses" aria-labelledby="cv-courses">
    <h2 id="cv-courses">$h_courses</h2>
    $courses
  </section>

  <section class="cv__section panel" data-sec="skills" aria-labelledby="cv-skills">
    <h2 id="cv-skills">$h_skills</h2>
    $skills
  </section>

  <section class="cv__section panel" data-sec="other" aria-labelledby="cv-other">
    <h2 id="cv-other">$h_other</h2>
    $other_experience
  </section>

  <section class="cv__section panel" data-sec="achievements" aria-labelledby="cv-achievements">
    <h2 id="cv-achievements">$h_achievements</h2>
    $achievements
  </section>
  </div>
  </div>
</article>
</main>

<footer class="footer panel">
  <div class="shell footer__inner">
    <p class="colophon">$colophon $updated <span data-stamp="build">$build</span>.</p>
    <div class="footer__links">
      <a href="mailto:$email">$email</a>
      <a href="$pdf">$pdf_label</a>
      <a href="$source">$source_label</a>
      <a href="$other" hreflang="$other_lang" lang="$other_lang">$lang_name</a>
    </div>
  </div>
</footer>
</div>
<nav class="tabbar" aria-label="$tab_label">
  <div class="tabbar__body glass">
    <span class="tabbar__lens" aria-hidden="true"></span>
    $tabs
  </div>
</nav>

<script type="module" src="/assets/js/main.js"></script>
</body>
</html>
""")

# Spaces a line must not break at: inside a number, between a number and its
# unit, and between a name and its version.
GLUE = re.compile(r"(?<=\d) (?=\d{3}(?!\d))|(?<=\d) (?=YH\b)|(?<=\bSwift) (?=\d)|(?<=\biOS) (?=\d)")


def text(value):
    """Escape content text and glue what belongs together."""
    return GLUE.sub("&#160;", html.escape(value, quote=False))


def attr(value):
    return html.escape(value, quote=True)


def tab_links(items, current):
    return "".join(
        '<a href="%s"%s><i><svg class="o" aria-hidden="true"><use href="%s#%s"/></svg><svg class="f" aria-hidden="true"><use href="%s#%s-f"/></svg></i><span>%s</span></a>'
        % (attr(href), ' aria-current="page"' if href == current else "", SPRITE, icon, SPRITE, icon, html.escape(label))
        for label, href, icon in items
    )


def contact(person, lang):
    phone_href = "tel:" + re.sub(r"[^\d+]", "", person["phone"])
    parts = [
        "<span>%s</span>" % html.escape(person["location"][lang]),
        '<a href="%s">%s</a>' % (phone_href, html.escape(person["phone"])),
        '<a href="mailto:%s">%s</a>' % (attr(person["email"]), html.escape(person["email"])),
    ] + ['<a href="%s">%s</a>' % (attr(link["url"]), html.escape(link["label"])) for link in person["links"]]
    return '<p class="cv__contact">%s</p>' % "".join(parts)


def bullets(items):
    return "<ul>%s</ul>" % "".join("<li>%s</li>" % text(b) for b in items)


# A letter quoted in English on the Swedish page is marked as English, so it is read in its own language.
QUOTED = re.compile(r"”([^”]+)”")


def experience(entries, tech, lang):
    out = []
    for e in entries:
        note = text(e["note"]) if e.get("note") else ""
        if note and lang == "sv":
            note = QUOTED.sub(r'”<span lang="en">\1</span>”', note)
        note = '<p class="cv__note">%s</p>' % note if note else ""
        out.append(
            '<div class="cv__item"><h3>%s</h3><p class="cv__meta">%s, %s</p><p class="cv__when">%s</p>%s<p class="cv__tech">%s: %s</p>%s</div>'
            % (text(e["role"]), text(e["org"]), text(e["place"]), text(e["period"]), bullets(e["bullets"]), tech, text(e["tech"]), note)
        )
    return "\n    ".join(out)


def projects(entries, tech):
    return "\n    ".join(
        '<div class="cv__item"><h3><a href="%s">%s</a></h3><p class="cv__meta">%s</p><p class="cv__when">%s</p>%s<p class="cv__tech">%s: %s</p></div>'
        % (attr(p["url"]), text(p["name"]), text(p["status"]), text(p["period"]), bullets(p["bullets"]), tech, text(p["tech"]))
        for p in entries
    )


def education(entries):
    return "\n    ".join(
        '<div class="cv__item"><h3>%s</h3><p class="cv__meta">%s, %s</p><p class="cv__when">%s</p><p class="cv__p">%s</p></div>'
        % (text(e["name"]), text(e["org"]), text(e["place"]), text(e["period"]), text(e["detail"]))
        for e in entries
    )


def courses(entries):
    out = []
    for c in entries:
        detail = '<p class="cv__p">%s</p>' % text(c["detail"]) if c.get("detail") else ""
        out.append(
            '<div class="cv__item"><h3>%s</h3><p class="cv__meta">%s, %s</p><p class="cv__when">%s</p>%s</div>'
            % (text(c["name"]), text(c["org"]), text(c["meta"]), text(c["period"]), detail)
        )
    return "\n    ".join(out)


LIST_END = re.compile(r" (?:and|och) (?=[^,]+$)")
OUTSIDE_PARENS = re.compile(r", (?![^(]*\))")


def chips(items):
    """A plain list of short names becomes chips; a trailing remark stays a sentence.
    Returns None when the text is not such a list, so it is shown as written."""
    head, dot, tail = items.partition(". ")
    remark = tail
    # One aside, at the end, is about the whole list; several belong to their names.
    aside = re.search(r" (\([^)]*\))$", head)
    if aside and head.count("(") == 1:
        head, remark = head[: aside.start()], (aside.group(1) + dot + tail).strip()
    names = OUTSIDE_PARENS.split(LIST_END.sub(", ", head))
    if len(names) < 2 or any(len(re.sub(r"\([^)]*\)", "", n).split()) > 3 for n in names):
        return None
    note = '<p class="cv__chipnote">%s</p>' % text(remark) if remark else ""
    return '<ul class="chips" aria-hidden="true">%s</ul>%s' % ("".join("<li>%s</li>" % text(n) for n in names), note)


def skills(groups, tracks):
    """Skill groups under their track. The sentence from cv.json is always in the
    page, for print and screen readers; where it reads as a list, chips show it."""
    named = {name for _, names in tracks for name in names}
    out = []
    for title, names in tracks:
        rows = []
        for g in groups:
            if g["group"] not in (names or [x["group"] for x in groups if x["group"] not in named]):
                continue
            shown = chips(g["items"])
            cls = ' class="cv__listed"' if shown else ""
            rows.append("<div%s><dt>%s</dt><dd><span>%s</span>%s</dd></div>" % (cls, text(g["group"]), text(g["items"]), shown or ""))
        if rows:
            out.append('<div class="cv__track"><h3>%s</h3><dl class="cv__skills">%s</dl></div>' % (html.escape(title), "".join(rows)))
    return "\n    ".join(out)


def other_experience(entries):
    return "\n    ".join(
        '<div class="cv__item"><h3>%s</h3><p class="cv__meta">%s</p><p class="cv__when">%s</p></div>'
        % (text(e["role"]), text(e["org"]), text(e["period"]))
        for e in entries
    )


def achievements(entries):
    return "\n    ".join(
        '<div class="cv__item"><h3>%s</h3><p class="cv__p">%s</p></div>' % (text(a["name"]), text(a["detail"])) for a in entries
    )


def jsonld(person, page, build):
    graph = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "ProfilePage",
                "@id": SITE + page["url"] + "#page",
                "url": SITE + page["url"],
                "name": page["title"],
                "inLanguage": page["in_language"],
                "dateModified": build,
                "isPartOf": {"@id": SITE + page["home"] + "#page"},
                "mainEntity": {"@id": PERSON_ID},
            },
            {
                "@type": "Person",
                "@id": PERSON_ID,
                "name": person["name"],
                "givenName": person["name"].split()[0],
                "familyName": person["name"].split()[-1],
                "jobTitle": page["job_title"],
                "url": SITE + "/",
                "email": "mailto:" + person["email"],
                "telephone": person["phone"],
                "address": {"@type": "PostalAddress", "addressLocality": "Malmö", "addressRegion": "Skåne", "addressCountry": "SE"},
                "sameAs": [link["url"] for link in person["links"] if not link["url"].startswith(SITE)],
                "knowsLanguage": ["sv", "en"],
            },
        ],
    }
    return json.dumps(graph, ensure_ascii=False, indent=2)


def render(lang, data, build):
    page = PAGES[lang]
    person = data["person"]
    content = data[lang]
    h = page["headings"]
    ctx = {
        "lang": lang,
        "site": SITE,
        "sprite": SPRITE,
        "mark": MARK,
        "url": page["url"],
        "other": page["other"],
        "other_lang": page["other_lang"],
        "home": page["home"],
        "pdf": page["pdf"],
        "locale": page["locale"],
        "title": attr(page["title"]),
        "description": attr(page["description"]),
        "jsonld": jsonld(person, page, build),
        "og_alt": attr(page["og_alt"]),
        "skip": html.escape(page["skip"]),
        "brand": attr(page["brand"]),
        "status": attr(page["status"]),
        "lang_label": page["lang_label"],
        "lang_name": page["lang_name"],
        "theme": attr(page["theme"]),
        "name": html.escape(person["name"]),
        "role": text(content["title"]),
        "keywords": text(content["keywords"]),
        "contact": contact(person, lang),
        "availability": text(content["availability"]),
        "download": html.escape(page["download"]),
        "print": html.escape(page["print"]),
        "profile": text(content["profile"]),
        "experience": experience(content["experience"], page["tech"], lang),
        "projects": projects(content["projects"], page["tech"]),
        "education": education(content["education"]),
        "courses": courses(content["courses"]),
        "skills": skills(content["skills"], page["tracks"]),
        "index": attr(page["index"]),
        "index_links": "".join('<a href="#cv-%s" data-to="%s">%s</a>' % (key, key, html.escape(label)) for key, label in page["index_items"]),
        "tools": attr(page["tools"]),
        "pdf_other": page["pdf_other"],
        "download_other": html.escape(page["download_other"]),
        "other_experience": other_experience(content["other_experience"]),
        "achievements": achievements(content["achievements"]),
        "updated": html.escape(page["updated"]),
        "build": build,
        "colophon": html.escape(page["colophon"]),
        "email": attr(person["email"]),
        "pdf_label": html.escape(page["pdf_label"]),
        "source": SOURCE,
        "source_label": html.escape(page["source"]),
        "tab_label": attr(page["tab_label"]),
        "tabs": tab_links(page["tabs"], page["url"]),
    }
    for key, value in h.items():
        ctx["h_" + key] = html.escape(value)
    return PAGE.substitute(ctx)


def main():
    with open(DATA, encoding="utf-8") as f:
        data = json.load(f)
    build = datetime.date.today().isoformat()
    for lang in PAGES:
        out = os.path.join(ROOT, PAGES[lang]["path"])
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "w", encoding="utf-8", newline="\n") as f:
            f.write(render(lang, data, build))
        print("wrote %s" % os.path.relpath(out, ROOT))


if __name__ == "__main__":
    main()
