#!/usr/bin/env python3
"""
Renders the CV pages from one data file.

  assets/data/cv.json  ->  cv/index.html (English) and sv/cv/index.html (Swedish)

tools/build-cv-pdf.js then prints the two A4 PDFs in assets/cv/ from these
pages, so the web pages and the PDFs cannot disagree. The HTML template lives
in this file; the CV content lives only in cv.json. Stdlib only.

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
        "pdf": "/assets/cv/Anton-Smedberg-CV.pdf",
        "locale": "en_GB",
        "in_language": "en-GB",
        "title": "Anton Smedberg — CV",
        "description": "CV of Anton Smedberg, iOS developer in Malmö: Swift 6, SwiftUI, Metal, AVFoundation and ARKit, with five months of production iOS work at Axis Communications in Lund. One page, also as a PDF.",
        "skip": "Skip to content",
        "brand": "Anton Smedberg — home",
        "nav_label": "Sections",
        "nav": [("Work", "/#work"), ("Experience", "/#experience"), ("Skills", "/#skills"), ("About", "/#about"), ("Contact", "/#contact")],
        "lang_switch": '<span aria-current="page">EN</span><span aria-hidden="true">/</span><a href="/sv/cv/" hreflang="sv" lang="sv" aria-label="Svenska">SV</a>',
        "theme": "Theme: follows the system. Switch to light",
        "kicker": "Curriculum vitae",
        "download": "Download PDF",
        "print": "Print",
        "switch": "Svenska",
        "headings": {
            "profile": "Profile", "facts": "Key facts", "experience": "Experience",
            "projects": "Projects", "education": "Education", "skills": "Skills",
            "languages": "Languages & references", "spoken": "Languages", "references": "References",
        },
        "updated": "Updated",
        "colophon": "Set in Instrument Serif, Instrument Sans and IBM Plex Mono, all self-hosted. This page and the PDF are generated from one data file, assets/data/cv.json, by tools/build-cv.py, so they cannot disagree.",
        "pdf_label": "CV (PDF)",
        "source": "Source",
        "folio_label": "Sections (bottom)",
        "folio": [("Work", "/#work"), ("Experience", "/#experience"), ("Skills", "/#skills"), ("CV", "/cv/"), ("Contact", "/#contact")],
    },
    "sv": {
        "path": "sv/cv/index.html",
        "url": "/sv/cv/",
        "other": "/cv/",
        "other_lang": "en",
        "home": "/sv/",
        "pdf": "/assets/cv/Anton-Smedberg-CV-SV.pdf",
        "locale": "sv_SE",
        "in_language": "sv-SE",
        "title": "Anton Smedberg — CV (svenska)",
        "description": "CV för Anton Smedberg, iOS-utvecklare i Malmö: Swift 6, SwiftUI, Metal, AVFoundation och ARKit, med fem månader iOS i produktion på Axis Communications i Lund. En sida, även som PDF.",
        "skip": "Hoppa till innehåll",
        "brand": "Anton Smedberg — startsida",
        "nav_label": "Avsnitt",
        "nav": [("Arbete", "/sv/#work"), ("Erfarenhet", "/sv/#experience"), ("Kompetens", "/sv/#skills"), ("Om", "/sv/#about"), ("Kontakt", "/sv/#contact")],
        "lang_switch": '<span aria-current="page">SV</span><span aria-hidden="true">/</span><a href="/cv/" hreflang="en" lang="en" aria-label="English">EN</a>',
        "theme": "Tema: följer systemet. Byt till ljust",
        "kicker": "Meritförteckning",
        "download": "Ladda ner PDF",
        "print": "Skriv ut",
        "switch": "English",
        "headings": {
            "profile": "Profil", "facts": "Nyckelfakta", "experience": "Erfarenhet",
            "projects": "Projekt", "education": "Utbildning", "skills": "Kompetens",
            "languages": "Språk & referenser", "spoken": "Språk", "references": "Referenser",
        },
        "updated": "Uppdaterad",
        "colophon": "Satt i Instrument Serif, Instrument Sans och IBM Plex Mono, alla självhostade. Sidan och PDF:en genereras från samma datafil, assets/data/cv.json, av tools/build-cv.py, så de kan inte skilja sig åt.",
        "pdf_label": "CV (PDF)",
        "source": "Källkod",
        "folio_label": "Avsnitt (nederst)",
        "folio": [("Arbete", "/sv/#work"), ("Erfarenhet", "/sv/#experience"), ("Kompetens", "/sv/#skills"), ("CV", "/sv/cv/"), ("Kontakt", "/sv/#contact")],
    },
}

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
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f6f1e8">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#141210">
<link rel="canonical" href="$site/cv/">
<link rel="alternate" hreflang="en" href="$site/cv/">
<link rel="alternate" hreflang="sv" href="$site/sv/cv/">
<link rel="alternate" hreflang="x-default" href="$site/cv/">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/img/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="Anton Smedberg — iOS Developer">
<meta property="og:title" content="$title">
<meta property="og:description" content="$description">
<meta property="og:url" content="$site$url">
<meta property="og:image" content="$site/assets/img/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="$locale">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="$title">
<meta name="twitter:description" content="$description">
<meta name="twitter:image" content="$site/assets/img/og-image.png">
<link rel="preload" href="/assets/fonts/instrument-serif-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/instrument-sans-wght.woff2" as="font" type="font/woff2" crossorigin>
<script>try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}</script>
<link rel="stylesheet" href="/assets/css/style.css">
<link rel="stylesheet" href="/assets/css/cv.css">
<script type="application/ld+json">
$jsonld
</script>
</head>
<body>
<a class="skip-link" href="#main">$skip</a>
<svg width="0" height="0" aria-hidden="true" focusable="false" class="visually-hidden">
  <symbol id="mark" viewBox="0 0 32 32"><path d="M3.5 29 16 3.5 28.5 29" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="miter" stroke-miterlimit="6"/><path class="rule" d="M0 20.5h32" stroke="#c33a1c" stroke-width="3"/></symbol>
  <symbol id="i-out" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M9 7h8v8"/></symbol>
  <symbol id="i-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13"/><path d="m12.5 6 6 6-6 6"/></symbol>
  <symbol id="i-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></symbol>
  <symbol id="i-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/></symbol>
  <symbol id="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></symbol>
  <symbol id="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></symbol>
</svg>

<header class="masthead">
  <div class="shell masthead__inner">
    <a class="brand" href="$home" aria-label="$brand"><svg aria-hidden="true"><use href="#mark"/></svg><span>Anton Smedberg</span></a>
    <nav class="nav" aria-label="$nav_label">
      $nav
    </nav>
    <div class="tools">
      <span class="lang">$lang_switch</span>
      <button class="theme" type="button" data-theme-toggle data-state="auto" aria-label="$theme"><svg class="i-auto" aria-hidden="true"><use href="#i-auto"/></svg><svg class="i-sun" aria-hidden="true"><use href="#i-sun"/></svg><svg class="i-moon" aria-hidden="true"><use href="#i-moon"/></svg></button>
      <a class="btn btn--ghost btn--sm" href="$url" aria-current="page">CV</a>
    </div>
  </div>
</header>

<main id="main" tabindex="-1">
<article class="cv shell" aria-labelledby="cv-name">
  <header class="cv__head">
    <p class="label cv__kicker">$kicker</p>
    <h1 class="cv__name" id="cv-name">$name</h1>
    <p class="role cv__role">$role</p>
    $contact
    <p class="cv__contact">$availability</p>
    <div class="actions">
      <a class="btn" href="$pdf" download>$download <svg aria-hidden="true"><use href="#i-down"/></svg></a>
      <button class="btn btn--ghost" type="button" data-print>$print</button>
      <a class="text-link" href="$other" hreflang="$other_lang" lang="$other_lang">$switch <svg aria-hidden="true"><use href="#i-arrow"/></svg></a>
    </div>
  </header>

  <section class="cv__section" aria-labelledby="cv-profile">
    <h2 class="label" id="cv-profile">$h_profile</h2>
    <div class="cv__text"><p>$profile</p></div>
  </section>

  <dl class="cv__facts" aria-label="$h_facts">
    $facts
  </dl>

  <section class="cv__section" aria-labelledby="cv-experience">
    <h2 class="label" id="cv-experience">$h_experience</h2>
    <ol class="cv__rows">
      $experience
    </ol>
  </section>

  <section class="cv__section" aria-labelledby="cv-projects">
    <h2 class="label" id="cv-projects">$h_projects</h2>
    <ul class="cv__rows">
      $projects
    </ul>
  </section>

  <section class="cv__section" aria-labelledby="cv-education">
    <h2 class="label" id="cv-education">$h_education</h2>
    <ol class="cv__rows">
      $education
    </ol>
  </section>

  <section class="cv__section" aria-labelledby="cv-skills">
    <h2 class="label" id="cv-skills">$h_skills</h2>
    <ul class="cv__rows">
      $skills
    </ul>
  </section>

  <section class="cv__section" aria-labelledby="cv-languages">
    <h2 class="label" id="cv-languages">$h_languages</h2>
    <ul class="cv__rows">
      <li class="cv__row"><p class="cv__key">$h_spoken</p><div><p>$languages</p></div></li>
      <li class="cv__row"><p class="cv__key">$h_references</p><div><p>$references</p></div></li>
    </ul>
  </section>

  <p class="label cv__meta">$updated <span data-stamp="build">$build</span></p>
</article>
</main>

<footer class="footer">
  <div class="shell footer__inner">
    <div>
      <a class="brand" href="$home" aria-label="$brand"><svg aria-hidden="true"><use href="#mark"/></svg><span>Anton Smedberg</span></a>
      <p class="colophon">$colophon</p>
    </div>
    <div class="footer__links">
      <a href="mailto:$email">$email</a>
      <a href="$pdf">$pdf_label</a>
      <a href="$source">$source_label</a>
      <a href="$other" hreflang="$other_lang" lang="$other_lang">$switch</a>
      <span>© <span data-year>$year</span> Anton Smedberg · Malmö</span>
    </div>
  </div>
</footer>

<nav class="folio" aria-label="$folio_label">
  $folio
</nav>

<script type="module" src="/assets/js/main.js"></script>
<script>document.querySelector('[data-print]')?.addEventListener('click',()=>print())</script>
</body>
</html>
""")

DIGIT_GROUP = re.compile(r"(?<=\d)[  ](?=\d{3}(?!\d))")


def text(value, stamps):
    """Escape content text, glue digit groups, expand {tests}/{hash} stamps."""
    out = html.escape(value, quote=False)
    out = DIGIT_GROUP.sub("&#160;", out)
    for key, stamp in stamps.items():
        out = out.replace("{%s}" % key, '<span data-stamp="%s">%s</span>' % (key, html.escape(stamp)))
    return out


def attr(value):
    return html.escape(value, quote=True)


def links(items):
    return "".join('<a href="%s">%s</a>' % (attr(href), html.escape(label)) for label, href in items)


def links_current(items, current):
    return "".join(
        '<a href="%s"%s>%s</a>' % (attr(href), ' aria-current="page"' if href == current else "", html.escape(label))
        for label, href in items
    )


def contact(person, lang):
    """Two mono lines: e-mail, phone and city; then the links."""
    phone_href = "tel:" + re.sub(r"[^\d+]", "", person["phone"])
    lines = [
        [
            '<a href="mailto:%s">%s</a>' % (attr(person["email"]), html.escape(person["email"])),
            '<a href="%s">%s</a>' % (phone_href, html.escape(person["phone"])),
            html.escape(person["location"][lang]),
        ],
        ['<a href="%s">%s</a>' % (attr(link["url"]), html.escape(link["label"])) for link in person["links"]],
    ]
    return "\n    ".join('<p class="cv__contact">%s</p>' % "".join("<span>%s</span>" % p for p in parts) for parts in lines)


def row(margin, body, margin_class="when label"):
    return '<li class="cv__row"><p class="%s">%s</p><div>%s</div></li>' % (margin_class, margin, body)


def experience(entries, stamps):
    out = []
    for e in entries:
        body = "<h3>%s</h3><p class=\"org cv__org\"><b>%s</b> · %s</p><ul>%s</ul>" % (
            text(e["role"], stamps),
            text(e["org"], stamps),
            text(e["place"], stamps),
            "".join("<li>%s</li>" % text(b, stamps) for b in e["bullets"]),
        )
        out.append(row(text(e["period"], stamps), body))
    return "\n      ".join(out)


def projects(entries, stamps):
    out = []
    for p in entries:
        body = '<h3><a href="%s">%s</a></h3><p class="cv__stack">%s</p><p class="cv__p">%s</p>' % (
            attr(p["url"]), text(p["name"], stamps), text(p["stack"], stamps), text(p["summary"], stamps)
        )
        out.append(row(text(p["status"], stamps), body))
    return "\n      ".join(out)


def education(entries, stamps):
    out = []
    for e in entries:
        body = '<h3>%s</h3><p class="org cv__org"><b>%s</b> · %s</p><p class="cv__p">%s</p>' % (
            text(e["name"], stamps), text(e["org"], stamps), text(e["place"], stamps), text(e["detail"], stamps)
        )
        out.append(row(text(e["period"], stamps), body))
    return "\n      ".join(out)


def skills(groups, stamps):
    # Group names carry product names (iOS), so they are not uppercase labels.
    return "\n      ".join(
        row(text(g["group"], stamps), "<p>%s</p>" % text(g["items"], stamps), margin_class="cv__key") for g in groups
    )


def facts(items, stamps):
    # Joined without whitespace: in print the cells run inline, separated by middots.
    return "".join(
        '<div><dt class="label">%s</dt><dd class="proof__value">%s</dd></div>' % (text(f["label"], stamps), text(f["value"], stamps))
        for f in items
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
                "isPartOf": {"@id": SITE + "/#page"},
                "mainEntity": {"@id": PERSON_ID},
            },
            {
                "@type": "Person",
                "@id": PERSON_ID,
                "name": person["name"],
                "givenName": person["name"].split()[0],
                "familyName": person["name"].split()[-1],
                "jobTitle": "iOS Developer",
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
    stamps = data["stamps"]
    h = page["headings"]
    ctx = {
        "lang": lang,
        "site": SITE,
        "url": page["url"],
        "other": page["other"],
        "other_lang": page["other_lang"],
        "home": page["home"],
        "pdf": page["pdf"],
        "locale": page["locale"],
        "title": attr(page["title"]),
        "description": attr(page["description"]),
        "jsonld": jsonld(person, page, build),
        "skip": html.escape(page["skip"]),
        "brand": attr(page["brand"]),
        "nav_label": attr(page["nav_label"]),
        "nav": links(page["nav"]),
        "lang_switch": page["lang_switch"],
        "theme": attr(page["theme"]),
        "kicker": html.escape(page["kicker"]),
        "name": html.escape(person["name"]),
        "role": text(content["title"], stamps),
        "contact": contact(person, lang),
        "availability": text(content["availability"], stamps),
        "download": html.escape(page["download"]),
        "print": html.escape(page["print"]),
        "switch": html.escape(page["switch"]),
        "h_profile": html.escape(h["profile"]),
        "h_facts": attr(h["facts"]),
        "h_experience": html.escape(h["experience"]),
        "h_projects": html.escape(h["projects"]),
        "h_education": html.escape(h["education"]),
        "h_skills": html.escape(h["skills"]),
        "h_languages": html.escape(h["languages"]),
        "h_spoken": html.escape(h["spoken"]),
        "h_references": html.escape(h["references"]),
        "profile": text(content["profile"], stamps),
        "facts": facts(content["facts"], stamps),
        "experience": experience(content["experience"], stamps),
        "projects": projects(content["projects"], stamps),
        "education": education(content["education"], stamps),
        "skills": skills(content["skills"], stamps),
        "languages": text(content["languages"], stamps),
        "references": text(content["references"], stamps),
        "updated": html.escape(page["updated"]),
        "build": build,
        "colophon": html.escape(page["colophon"]),
        "email": attr(person["email"]),
        "pdf_label": html.escape(page["pdf_label"]),
        "source": SOURCE,
        "source_label": html.escape(page["source"]),
        "year": build[:4],
        "folio_label": attr(page["folio_label"]),
        "folio": links_current(page["folio"], page["url"]),
    }
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
