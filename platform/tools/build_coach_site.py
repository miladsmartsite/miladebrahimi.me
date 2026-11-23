#!/usr/bin/env python3
"""Builds the public ME.Coach pages in platform/coach/.

index.html holds both the public landing page (#site, readable by search engines)
and the app shell (#app). Signed-in visitors skip straight to the app.
Prices here must match PLANS in platform/coach/api.php.

Run:  python3 platform/tools/build_coach_site.py
"""
import html
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent / 'coach'
VERSION = '12.1.0'
BASE = 'https://miladebrahimi.me/coach/'

PLANS = [
    # key, name, omr, usd, per, blurb, points, featured
    ('monthly', 'Pro Monthly', '2.900', '7.99', 'month', 'Full ME.Coach, month by month.',
     ['Wheel of Life test and 40-day cycles', 'Morning & Night Balance', '9 self-discovery tests and your personal pack', 'Career explorer', 'Habits, focus, calm, boards and widgets', 'Cancel any time'], False),
    ('yearly', 'Pro Yearly', '24.000', '59', 'year', 'A full year of cycles, about 30% cheaper.',
     ['Everything in Pro Monthly', 'Nine 40-day cycles a year', 'Priority email support', 'Best value'], True),
    ('coach', 'Coaching', '25.000', '65', 'month', 'The app plus a real coach.',
     ['Everything in Pro', 'One 1:1 session a month with Milad (online, 45 min)', 'Monthly plan and Wheel review', 'Limited places'], False),
]

ICON = {
    'wheel': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/></svg>',
    'cycle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/></svg>',
    'sun': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    'cal': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    'tick': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    'board': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="5" height="15" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/></svg>',
    'calm': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 21c-4-2.5-7-6-7-10a7 7 0 0 1 14 0c0 4-3 7.5-7 10z"/></svg>',
    'chart': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    'ring': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/></svg>',
    'lock': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    'book': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>',
    'spark': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4z"/></svg>',
    'compass': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>',
    'phone': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/></svg>',
}

FEATURES = [
    ('wheel', 'Wheel of Life test', 'Score the eight areas of your life in two minutes. See your balance as a wheel and watch it change from cycle to cycle.', 's3-wheel'),
    ('cycle', '40-day cycles', 'Pick one to three areas, set one goal each and commit for 40 days. Long enough to change, short enough to stay focused.', 's5-coach'),
    ('sun', 'Morning & Night Balance', 'One minute in the morning to set your focus and Top 3. One minute at night to score the day and plan tomorrow.', 's1-today'),
    ('cal', 'Day timeline and calendar', 'Your day as a visual timeline, plus a calendar that feels like the one you already use. Sync to your phone calendar.', 's7-calendar'),
    ('tick', 'Habits and streaks', 'Pick the days, tick with one tap, keep your streaks. A 12-week heatmap shows the truth.', 's2-habits'),
    ('board', 'Boards for every project', 'A Trello-style board and a Notion-style table for each project, with its own daily tasks.', 's6-board'),
    ('calm', 'Focus and Calm', 'A calm full-screen focus timer with ambient sound, breathing exercises and short guided reflections.', 's9-breathe'),
    ('chart', 'Insights', 'Clear charts of your day scores, focus time, habits and balance over 7, 30 or 90 days.', 's4-insights'),
    ('spark', 'Self-discovery tests', 'DISC, 16 types, Big Five, Enneagram, career interests, values, conflict style and emotional intelligence. Every result adds to your personal pack.', 's12-test'),
    ('compass', 'Career explorer', 'Turn your experience into a skill fingerprint, see the careers that fit you on a visual map and make the best one your next goal.', 's13-career'),
    ('ring', 'Rings, levels and widgets', 'Close three daily rings, earn points and badges, and keep your progress on your home screen with live widgets.', 's1b-today-plan'),
]

FAQ = [
    ('What is ME.Coach?', 'A daily self-coaching app. You take the Wheel of Life test, get a personal plan for the next 40 days, and spend one minute every morning and night to stay on track. It applies the method from the book <i>Self-Coaching Blueprint</i> by Milad Ebrahimi.'),
    ('How does the free trial work?', 'You get every feature for 7 days. No card is needed to start. After 7 days you choose a plan to keep editing. Everything you created stays safe and readable.'),
    ('Does it work on iPhone, iPad, Android and computers?', 'Yes. ME.Coach runs in the browser and installs like an app: on iPhone or iPad open it in Safari, tap Share, then Add to Home Screen. On Android and computers use Install in Chrome or Edge. It also works offline.'),
    ('How do I sign in?', 'With Face ID or Touch ID (passkeys), with Google, or with email and password. We recommend setting up Face ID right after you sign up.'),
    ('Who can see my data?', 'Only you. Each account has its own private space. Nothing is sold, shared or used for advertising. You can download all your data at any time.'),
    ('Can I cancel?', 'Yes, at any time. Your plan stays active until the end of the period you paid for.'),
    ('What is the Coaching plan?', 'Everything in Pro plus one online 1:1 session a month with Milad Ebrahimi, author of <i>Self-Coaching Blueprint</i>, to review your Wheel, your cycle and your plan. Places are limited.'),
    ('Can I pay in Omani rial?', 'Yes. Prices are shown in Omani rial and US dollars. Card payment and local options are available; if you prefer bank transfer, choose a plan in the app and follow the instructions.'),
    ('Which tests are included?', 'DISC style, 16 Types (an independent, MBTI-style questionnaire based on Jung’s ideas; not the official MBTI), Big Five, Enneagram, career interests (Holland RIASEC), core values, conflict style, emotional intelligence and an energy check. They come with any paid plan; the Wheel of Life test is free for everyone. They are tools for reflection, not clinical or hiring assessments.'),
    ('Who is Emi?', 'Emi is your 3D guide inside ME.Coach. Emi waves in the morning, cheers when you keep a habit, breathes with you in Calm, celebrates finished tests and suggests your next tiny step. You can hide Emi any time.'),
    ('Is the book really free?', 'Yes. Download the PDF of <i>Self-Coaching Blueprint</i> from this site or inside the app.'),
]

CSS_V = VERSION
e = html.escape


def head(title, desc, path, extra=''):
    url = BASE + path
    return f'''<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website"><meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{url}"><meta property="og:image" content="{BASE}assets/img/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#232a45">
<link rel="icon" type="image/png" href="icons/favicon.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
{extra}<link rel="stylesheet" href="assets/site.css?v={CSS_V}">
</head>
'''


def nav(active=''):
    links = [('features.html', 'Features'), ('pricing.html', 'Pricing'), ('book.html', 'Free book'), ('faq.html', 'FAQ')]
    items = ''.join(f'<a href="{h}"{" class=on" if active == h else ""}>{l}</a>' for h, l in links)
    return f'''<header class="s-nav"><div class="s-wrap s-nav-in"><a class="s-brand" href="./">ME<b>.</b>Coach</a><nav class="s-links">{items}</nav><span class="s-sp"></span><a class="s-lang" href="ar.html" lang="ar">العربية</a><a class="s-lang" href="fa.html" lang="fa">فارسی</a><a class="s-btn ghost" href="./?signin=1" data-act="l-signin">Sign in</a><a class="s-btn primary" href="./?start=1" data-act="l-start">Start free</a></div></header>'''


def footer():
    return f'''<footer class="s-foot"><div class="s-wrap s-foot-in">
<div><a class="s-brand" href="./">ME<b>.</b>Coach</a><p>Daily self-coaching, based on the book <i>Self-Coaching Blueprint</i> by Milad Ebrahimi.</p></div>
<div><b>Product</b><a href="features.html">Features</a><a href="pricing.html">Pricing</a><a href="faq.html">FAQ</a><a href="./?start=1">Start free</a></div>
<div><b>Learn</b><a href="book.html">Free book</a><a href="https://miladebrahimi.me/">Milad Ebrahimi</a></div>
<div><b>Legal</b><a href="privacy.html">Privacy</a><a href="terms.html">Terms and refunds</a><a href="mailto:info@miladebrahimi.me">info@miladebrahimi.me</a></div>
</div><div class="s-wrap s-copy">© 2026 Milad Ebrahimi · Muscat, Oman</div></footer>'''


def shot(name, alt, cls=''):
    return f'<figure class="phone {cls}"><img src="assets/img/{name}.webp" alt="{e(alt)}" width="390" height="844" loading="lazy" decoding="async"></figure>'


def price_cards(compact=False):
    out = []
    for key, name, omr, usd, per, blurb, pts, feat in PLANS:
        out.append(f'''<div class="s-plan{' best' if feat else ''}">{'<span class="tag">Best value</span>' if feat else ''}<h3>{name}</h3><p class="muted">{blurb}</p>
<div class="price"><span data-cur="omr">{omr} <small>OMR</small></span><span data-cur="usd" hidden>${usd}</span><small> / {per}</small></div>
<a class="s-btn {'primary' if feat else ''} wide" href="./?start=1" data-act="l-start">Start 7-day free trial</a>
<ul>{''.join(f'<li>{p}</li>' for p in pts)}</ul></div>''')
    return f'''<div class="cur-sw" role="group" aria-label="Currency"><button class="on" data-cur-btn="omr">OMR</button><button data-cur-btn="usd">USD</button></div><div class="s-plans">{''.join(out)}</div>
<p class="muted center">Every plan starts with 7 days free. No card needed to start. Cancel any time.</p>'''


CUR_JS = '''<script>(function(){var k='mec.cur',c;try{c=localStorage.getItem(k)}catch(e){}if(!c){try{c=/Muscat|Dubai|Riyadh|Qatar|Bahrain|Kuwait/.test(Intl.DateTimeFormat().resolvedOptions().timeZone)?'omr':'usd'}catch(e){c='usd'}}
function set(v){document.querySelectorAll('[data-cur]').forEach(function(x){x.hidden=x.getAttribute('data-cur')!==v});document.querySelectorAll('[data-cur-btn]').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-cur-btn')===v)});try{localStorage.setItem(k,v)}catch(e){}}
document.addEventListener('click',function(ev){var b=ev.target.closest('[data-cur-btn]');if(b)set(b.getAttribute('data-cur-btn'))});set(c)})();</script>'''


def book_block(h='h2'):
    return f'''<section class="s-sec s-book" id="book"><div class="s-wrap s-book-in">
<img src="assets/img/book-3d-lg.webp" alt="Self-Coaching Blueprint by Milad Ebrahimi, book cover" width="330" height="420" loading="lazy">
<div><span class="kicker">Free book</span><{h}>Self-Coaching Blueprint</{h}><p class="lead">A repeatable plan to boost your efficiency and achieve your goals. The balanced goal-setting system, the Wheel of Life test and the practical tables behind ME.Coach, in 102 pages.</p>
<div class="s-ctas"><a class="s-btn primary" href="api.php?action=book" download>Download the PDF</a><a class="s-btn" href="book.html">About the book</a></div><p class="muted small">PDF · 1.3 MB · English · First edition 2025 · ISBN 978-622-4836-62-5</p></div></div></section>'''


def page(path, title, desc, body, active='', extra_head=''):
    doc = head(title, desc, path, extra_head) + '<body class="s-page">\n' + nav(active) + '<main>' + body + '</main>' + footer() + CUR_JS + '\n</body>\n</html>\n'
    (ROOT / path).write_text(doc, encoding='utf-8')


def faq_html(items):
    return ''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q, a in items)


def ld_json():
    data = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'SoftwareApplication', 'name': 'ME.Coach', 'applicationCategory': 'LifestyleApplication', 'operatingSystem': 'iOS, Android, Windows, macOS (web app)', 'url': BASE,
         'description': 'Daily self-coaching app: Wheel of Life test, 40-day cycles, Morning and Night Balance, habits, focus and insights.',
         'offers': [{'@type': 'Offer', 'name': n, 'price': usd, 'priceCurrency': 'USD'} for _, n, _, usd, *_ in PLANS], 'author': {'@type': 'Person', 'name': 'Milad Ebrahimi', 'url': 'https://miladebrahimi.me/'}},
        {'@type': 'Book', 'name': 'Self-Coaching Blueprint', 'author': {'@type': 'Person', 'name': 'Milad Ebrahimi'}, 'isbn': '978-622-4836-62-5', 'numberOfPages': 102, 'inLanguage': 'en', 'datePublished': '2025-01'},
        {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': html.unescape(a.replace('<i>', '').replace('</i>', ''))}} for q, a in FAQ]}]}
    return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + '</script>\n'


def landing_html():
    feats = ''.join(f'<div class="s-feat"><span class="fi">{ICON[i]}</span><h3>{t}</h3><p>{d}</p></div>' for i, t, d, _ in FEATURES)
    return f'''<div id="site">{nav()}
<main>
<section class="s-hero"><div class="s-wrap s-hero-in">
<div class="s-hero-t"><span class="kicker">Based on the book <i>Self-Coaching Blueprint</i></span>
<h1>Your coach,<br><em>one minute</em> a day.</h1>
<p class="lead">Take the Wheel of Life test, get a personal 40-day plan, and keep it alive with a one-minute Morning and Night Balance. Habits, focus, calm and progress in one calm, visual app.</p>
<div class="s-ctas"><a class="s-btn primary big" href="./?start=1" data-act="l-start">Take the free test</a><a class="s-btn big" href="#how">See how it works</a></div>
<p class="muted small">7 days free · no card needed · iPhone, iPad, Android and computer</p></div>
<div class="s-hero-v">{shot('s1-today', 'ME.Coach Today screen with coach message, daily rings and widgets', 'tilt-l')}{shot('s3-wheel', 'Wheel of Life result in ME.Coach', 'tilt-r back')}</div>
</div></section>

<section class="s-strip"><div class="s-wrap s-strip-in"><span>{ICON['wheel']} Wheel of Life test</span><span>{ICON['cycle']} 40-day cycles</span><span>{ICON['sun']} 1-minute check-ins</span><span>{ICON['lock']} Face ID sign-in</span><span>{ICON['phone']} Works offline</span></div></section>

<section class="s-sec" id="how"><div class="s-wrap"><span class="kicker">How it works</span><h2>Test first. Then a plan. Then one minute a day.</h2>
<div class="s-steps">
<div class="s-step"><b>1</b>{shot('o1-wheel-step', 'A step of the Wheel of Life test')}<h3>Take the test</h3><p>Type your name, then just tap: your focus, your first goal and a quick Wheel of Life. About one minute. Later, take the full 80-question Balance Wheel Test from the book.</p></div>
<div class="s-step"><b>2</b>{shot('o3-plan', 'Personal plan created after the test')}<h3>Get your plan</h3><p>Your goal, your weakest area, your first 40-day cycle, habits and today's Top 3, ready before you sign up.</p></div>
<div class="s-step"><b>3</b>{shot('s1b-today-plan', 'Daily plan with timeline in ME.Coach')}<h3>One minute, morning and night</h3><p>Plan the day, close the day, tick your habits. Your coach message and rings update through the day.</p></div>
</div><div class="s-ctas center"><a class="s-btn primary big" href="./?start=1" data-act="l-start">Start my free test</a></div></div></section>

<section class="s-sec alt"><div class="s-wrap"><span class="kicker">Everything in one place</span><h2>The tools a coach would give you</h2><div class="s-feats">{feats}</div>
<div class="s-ctas center"><a class="s-btn" href="features.html">See every feature</a></div></div></section>

<section class="s-sec"><div class="s-wrap s-split">
<div><span class="kicker">Built for real life</span><h2>Plan like Notion. Move like Trello. Feel like a calm app.</h2>
<p class="lead">Every project gets its own board and table. Your day becomes a timeline. When it gets heavy, take two minutes to breathe. ME.Coach keeps the whole picture, so you only think about the next step.</p>
<ul class="s-list"><li>Drag cards between To do, Doing, Waiting and Done</li><li>Breathing exercises and short guided reflections</li><li>Live widgets for your iPhone, iPad and desktop</li><li>Sign in with Face ID or Google</li></ul></div>
<div class="s-duo">{shot('s6-board', 'Project board in ME.Coach')}{shot('s8-calm', 'Calm screen with breathing and meditation')}</div></div></section>

<section class="s-sec alt" id="emi"><div class="s-wrap s-split"><div><span class="kicker">Meet Emi</span><h2>A guide that walks with you, every day.</h2>
<p class="lead">Emi lives in your app. Emi waves in the morning, cheers when you keep a habit, breathes with you in Calm, celebrates every finished test and points you to your next tiny step.</p>
<ul class="s-list"><li>Reacts to what you do, all day</li><li>Suggests your next step in each life area</li><li>Sits with you during every test</li></ul><p class="muted small">Drag Emi to see every side. Tap for a reaction.</p></div>
<div class="s-emi" id="site-emi" aria-label="Emi, the ME.Coach guide, in 3D"><img src="assets/img/emi.webp" alt="Emi, the ME.Coach guide" width="420" height="480" loading="lazy"></div></div></section>
<script>(function(){{var el=document.getElementById('site-emi');if(!el||!('IntersectionObserver' in window))return;var go=function(){{var l=function(s,cb){{var x=document.createElement('script');x.src=s;x.onload=cb;document.head.appendChild(x)}};l('assets/vendor/three.min.js?v={VERSION}',function(){{l('assets/emi.js?v={VERSION}',function(){{if(!window.Emi||!Emi.supported())return;el.innerHTML='';var e=Emi.mount(el,{{orbit:true,zoom:6.6}});if(e){{e.play('wave');e.say('Hi, I am Emi! Drag me around.',4000)}}}})}})}};var io=new IntersectionObserver(function(es){{if(es[0].isIntersecting){{io.disconnect();go()}}}},{{rootMargin:'200px'}});io.observe(el)}})();</script>

<section class="s-sec"><div class="s-wrap s-split rev"><div><span class="kicker">Know yourself</span><h2>Nine tests. One personal pack.</h2>
<p class="lead">DISC, 16 types, Big Five, Enneagram, career interests, values, conflict style and emotional intelligence. ME.Coach turns your answers into one pack: who you are, how you work best, how to deal with other people, and tiny steps for each area of your life.</p>
<ul class="s-list"><li>A “How to talk to me” card you can share with your team</li><li>Career fit from your interests and your experience</li><li>Micro-actions for all 8 areas of the Wheel of Life</li></ul></div>
<div class="s-duo">{shot('s12-test', 'DISC result in ME.Coach')}{shot('s15-pack', 'Self-knowledge pack in ME.Coach')}</div></div></section>

<section class="s-sec alt"><div class="s-wrap s-split"><div><span class="kicker">Career explorer</span><h2>From your story to your next career.</h2>
<p class="lead">Add the roles you have had and what you want more of. ME.Coach builds your skill fingerprint and career identity, maps the careers that fit you, shows the skills you have and the ones to build, and turns your choice into a goal with milestones and micro-actions.</p></div>
{shot('s13-career', 'Career map in ME.Coach')}</div></section>

{book_block()}

<section class="s-sec"><div class="s-wrap s-author"><div><span class="kicker">From the author</span><blockquote>“Every individual faces unique challenges and questions in life, and as coaches, our role is to guide you toward discovering your own answers. I created this as a step-by-step guide to help you uncover those answers and achieve your goals with greater speed and efficiency.”</blockquote>
<p><b>Milad Ebrahimi</b> · productivity coach, author and international trainer, founder of Milad Ebrahimi Academy</p></div></div></section>

<section class="s-sec alt" id="pricing"><div class="s-wrap"><span class="kicker">Pricing</span><h2>Simple plans. Start free.</h2>{price_cards()}</div></section>

<section class="s-sec"><div class="s-wrap s-narrow"><span class="kicker">Questions</span><h2>Good to know</h2><div class="s-faq">{faq_html(FAQ[:6])}</div><p class="center"><a href="faq.html">All questions</a></p></div></section>

<section class="s-final"><div class="s-wrap"><h2>Your next 40 days can look different.</h2><p class="lead">Start with the free Wheel of Life test. Two minutes. No card.</p><a class="s-btn primary big" href="./?start=1" data-act="l-start">Take the free test</a></div></section>
</main>
{footer()}
</div>'''


def build_index():
    title = 'ME.Coach · Your self-coaching app, one minute a day'
    desc = 'Take the free Wheel of Life test and get a personal 40-day plan. Morning and Night Balance, habits, focus, calm and insights. Based on the book Self-Coaching Blueprint. 7 days free.'
    doc = head(title, desc, '', extra=f'''<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ME.Coach">
<link rel="manifest" href="manifest.webmanifest">
<script>try{{if(localStorage.getItem("mec.token"))document.documentElement.classList.add("in-app");var u=JSON.parse(localStorage.getItem("mec.ui")||"{{}}"),m=u.theme||"auto";if(m==="dark"||(m==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark");if(u.size==="large")document.documentElement.classList.add("large")}}catch(e){{}}</script>
<link rel="stylesheet" href="assets/app.css?v={VERSION}">
{ld_json()}''')
    doc += f'''<body>
{landing_html()}
<div id="app" aria-live="polite"><div class="boot"><div class="boot-mark">ME<span>.COACH</span></div></div></div>
<noscript><style>#app{{display:none}}</style></noscript>
{CUR_JS}
<script src="assets/fa.js?v={VERSION}" defer></script>
<script src="assets/ar.js?v={VERSION}" defer></script>
<script src="assets/app.js?v={VERSION}" defer></script>
</body>
</html>
'''
    (ROOT / 'index.html').write_text(doc, encoding='utf-8')


def build_features():
    rows = ''.join(f'''<section class="s-sec{' alt' if n % 2 else ''}"><div class="s-wrap s-split{' rev' if n % 2 else ''}"><div><span class="fi big">{ICON[i]}</span><h2>{t}</h2><p class="lead">{d}</p></div>{shot(img, t)}</div></section>''' for n, (i, t, d, img) in enumerate(FEATURES))
    body = f'''<section class="s-head"><div class="s-wrap"><span class="kicker">Features</span><h1>Everything you need to coach yourself</h1><p class="lead">ME.Coach brings the method of <i>Self-Coaching Blueprint</i> into one daily app: test, plan, act, review.</p><div class="s-ctas center"><a class="s-btn primary big" href="./?start=1" data-act="l-start">Take the free test</a></div></div></section>
{rows}
<section class="s-sec"><div class="s-wrap"><h2>And the details that make it easy</h2><div class="s-feats">
<div class="s-feat"><span class="fi">{ICON['lock']}</span><h3>Face ID and Google sign-in</h3><p>Passkeys mean no password to remember. Or continue with your Google account.</p></div>
<div class="s-feat"><span class="fi">{ICON['phone']}</span><h3>Installs like an app</h3><p>Add it to your home screen on iPhone, iPad and Android, or install it on your computer. Works offline.</p></div>
<div class="s-feat"><span class="fi">{ICON['cal']}</span><h3>Phone calendar and Siri</h3><p>See your plan in Apple or Google Calendar, and add tasks by voice with Siri Shortcuts.</p></div>
<div class="s-feat"><span class="fi">{ICON['sun']}</span><h3>Reminders</h3><p>A gentle nudge for your Morning and Night Balance, at the times you choose.</p></div>
<div class="s-feat"><span class="fi">{ICON['chart']}</span><h3>Your data, exportable</h3><p>Download everything as a file at any time, including an encrypted backup.</p></div>
<div class="s-feat"><span class="fi">{ICON['book']}</span><h3>The book included</h3><p>The full <i>Self-Coaching Blueprint</i> PDF, free.</p></div>
</div></div></section>
<section class="s-final"><div class="s-wrap"><h2>Try every feature free for 7 days</h2><a class="s-btn primary big" href="./?start=1" data-act="l-start">Start free</a></div></section>'''
    page('features.html', 'Features · ME.Coach', 'Wheel of Life test, 40-day cycles, Morning and Night Balance, habits, boards, focus, calm, insights and widgets in one self-coaching app.', body, 'features.html')


def build_pricing():
    rows = [('Wheel of Life test and 40-day cycles', '✓', '✓', '✓'), ('Morning & Night Balance', '✓', '✓', '✓'), ('Habits, focus, calm, insights', '✓', '✓', '✓'), ('Boards, calendar, widgets, Siri', '✓', '✓', '✓'), ('Free book (PDF)', '✓', '✓', '✓'), ('Priority support', '', '✓', '✓'), ('Monthly 1:1 session with Milad', '', '', '✓'), ('Monthly plan and Wheel review', '', '', '✓')]
    table = '<div class="s-table"><table><thead><tr><th></th>' + ''.join(f'<th>{p[1]}</th>' for p in PLANS) + '</tr></thead><tbody>' + ''.join(f'<tr><td>{r[0]}</td>' + ''.join(f'<td>{c}</td>' for c in r[1:]) + '</tr>' for r in rows) + '</tbody></table></div>'
    faq = [FAQ[1], FAQ[5], FAQ[6], FAQ[7], ('Do you offer refunds?', 'Yes. If ME.Coach is not for you, write to us within 14 days of your first payment and we refund it in full. See <a href="terms.html">terms and refunds</a>.'), ('Is there a discount for teams or schools?', 'Yes. Write to <a href="mailto:info@miladebrahimi.me">info@miladebrahimi.me</a> for group pricing.')]
    body = f'''<section class="s-head"><div class="s-wrap"><span class="kicker">Pricing</span><h1>Start free. Choose a plan when you are ready.</h1><p class="lead">Every plan includes the full app and the free book.</p></div></section>
<section class="s-sec" style="padding-top:0"><div class="s-wrap">{price_cards()}</div></section>
<section class="s-sec alt"><div class="s-wrap"><h2>Compare plans</h2>{table}</div></section>
<section class="s-sec"><div class="s-wrap s-narrow"><h2>Billing questions</h2><div class="s-faq">{faq_html(faq)}</div></div></section>'''
    page('pricing.html', 'Pricing · ME.Coach', 'ME.Coach plans: Pro Monthly 2.900 OMR ($7.99), Pro Yearly 24 OMR ($59), Coaching 25 OMR ($65). 7 days free, no card needed.', body, 'pricing.html')


def build_book():
    body = book_block('h1').replace('class="s-sec s-book"', 'class="s-sec s-book first"') + '''<section class="s-sec"><div class="s-wrap s-narrow s-prose">
<h2>What is inside</h2>
<p>In this book, we won’t introduce anything entirely new, but rather remind you of what you already know, so you can use it to transform your life. It is a practical guide that equips you with the tools and knowledge to take action.</p>
<ul><li>A balanced goal-setting system across the areas of your life</li><li>The Wheel of Life test</li><li>A personalised roadmap for 40 days</li><li>Practical tables for Morning and Night Balance</li></ul>
<h2>Book details</h2>
<table class="s-kv"><tr><td>Title</td><td>Self-Coaching Blueprint: A Repeatable Plan to Boost Your Efficiency and Achieve Your Goals</td></tr><tr><td>Author</td><td>Milad Ebrahimi</td></tr><tr><td>Edition</td><td>First edition, January 2025</td></tr><tr><td>Pages</td><td>102</td></tr><tr><td>Language</td><td>English</td></tr><tr><td>ISBN</td><td>978-622-4836-62-5</td></tr></table>
<h2>Use the book with the app</h2><p>ME.Coach turns every tool in the book into a daily routine: the Wheel of Life test, the 40-day cycle, and the one-minute Morning and Night Balance. Read the book, then <a href="./?start=1">take the free test</a>.</p>
</div></section>'''
    page('book.html', 'Self-Coaching Blueprint · free PDF by Milad Ebrahimi', 'Download Self-Coaching Blueprint by Milad Ebrahimi free: a repeatable plan to boost your efficiency and achieve your goals, with the Wheel of Life test and practical tables.', body, 'book.html')


def build_faq():
    body = f'''<section class="s-head"><div class="s-wrap"><span class="kicker">FAQ</span><h1>Questions and answers</h1></div></section>
<section class="s-sec" style="padding-top:0"><div class="s-wrap s-narrow"><div class="s-faq">{faq_html(FAQ)}</div>
<p class="muted">Still have a question? Write to <a href="mailto:info@miladebrahimi.me">info@miladebrahimi.me</a>.</p></div></section>'''
    page('faq.html', 'FAQ · ME.Coach', 'Answers about ME.Coach: free trial, devices, sign-in, privacy, plans, payment in Omani rial and the free book.', body, 'faq.html')


def legal(path, title, sections, desc):
    inner = ''.join(f'<h2>{h}</h2>' + ''.join(f'<p>{p}</p>' for p in ps) for h, ps in sections)
    body = f'''<section class="s-head"><div class="s-wrap s-narrow"><h1>{title}</h1><p class="muted">Last updated 16 November 2026</p></div></section><section class="s-sec" style="padding-top:0"><div class="s-wrap s-narrow s-prose">{inner}</div></section>'''
    page(path, title + ' · ME.Coach', desc, body)


def build_legal():
    legal('privacy.html', 'Privacy policy', [
        ('Who we are', ['ME.Coach is operated by Milad Ebrahimi, Muscat, Sultanate of Oman. Contact: <a href="mailto:info@miladebrahimi.me">info@miladebrahimi.me</a>.']),
        ('What we collect', ['Your account details (name, email; a password hash if you use a password; a passkey public key if you use Face ID or Touch ID; your Google account email and ID if you sign in with Google).', 'The content you create in the app: goals, tasks, habits, check-ins, wheel scores and similar records.', 'Payment status (plan and end date). Card details are handled by the payment provider and never reach our server.', 'Basic technical logs needed to run and protect the service.']),
        ('How we use it', ['Only to provide ME.Coach to you: store and sync your data, send the reminders you turn on, and manage your subscription. We do not sell your data, share it with advertisers, or use it to train AI models.']),
        ('Where it is stored', ['On our hosting server in a private folder for your account. Data you keep on your device stays in your browser storage until you sign out.']),
        ('Your choices', ['You can download all your data at any time from Settings. To delete your account and data, email us from your account email and we delete it within 30 days.']),
        ('Cookies', ['We use one essential sign-in cookie and your browser storage to keep you signed in and work offline. No tracking or advertising cookies.']),
        ('Changes', ['If we change this policy we update the date above and, for important changes, tell you in the app.'])], 'How ME.Coach handles your data.')
    legal('terms.html', 'Terms and refunds', [
        ('The service', ['ME.Coach is a self-coaching tool. It does not replace medical, psychological, legal or financial advice. If you are in crisis, contact local emergency services.']),
        ('Accounts', ['You are responsible for your account and for keeping your sign-in methods safe. One account per person.']),
        ('Free trial', ['New accounts get 7 days of full access. No payment details are needed for the trial. After the trial your data stays readable; editing needs an active plan.']),
        ('Plans and payment', ['Prices are shown in Omani rial (OMR) and US dollars (USD) and may include taxes where the payment provider applies them. Subscriptions renew automatically until cancelled. You can cancel at any time; your plan stays active until the end of the paid period.', 'The Coaching plan includes one online 1:1 session per month, booked in advance. Unused sessions do not carry over.']),
        ('Refunds', ['If you are not happy, email <a href="mailto:info@miladebrahimi.me">info@miladebrahimi.me</a> within 14 days of your first payment for a full refund. Renewals can be refunded within 7 days if the service was not used after the renewal.']),
        ('The book', ['The <i>Self-Coaching Blueprint</i> PDF is free for personal use. Please do not sell or republish it. © 2025 Milad Ebrahimi. All rights reserved.']),
        ('Changes and contact', ['We may update these terms; the date above shows the latest version. Questions: <a href="mailto:info@miladebrahimi.me">info@miladebrahimi.me</a>.'])], 'Terms of use, subscriptions and refund policy for ME.Coach.')


REGIONAL = {
    'ar': dict(file='ar.html', title='ME.Coach · مدربك الشخصي، دقيقة واحدة يوميًا', desc='تطبيق تدريب ذاتي مبني على كتاب Self-Coaching Blueprint: عجلة الحياة، أهداف 40 يومًا، خطوات صغيرة يومية، وتوازن الصباح والمساء. بالريال العماني.',
        kicker='مبني على كتاب «Self-Coaching Blueprint» لميلاد إبراهيمي', h1='مدربك الشخصي، دقيقة واحدة يوميًا', lead='قيّم عجلة حياتك، اختر ما يهمك في الأربعين يومًا القادمة، وحوّل كل هدف إلى خطوات صغيرة تنجزها كل يوم. توازن صباحي ومسائي في دقيقة، وتقرير واضح لتقدمك.',
        cta='ابدأ مجانًا لمدة 7 أيام', note='بدون بطاقة · بياناتك ملكك · يعمل على iPhone وAndroid والكمبيوتر', signin='تسجيل الدخول',
        feat_h='كل ما يسألك عنه المدرب، كل يوم', feats=[('🎯', 'عجلة الحياة', '80 سؤالًا من الكتاب في 8 مجالات، ونتيجة لكل كلمة مفتاحية.'), ('🗓', 'أهداف 40 يومًا', 'خمس خطوات: المجال، الكلمة المفتاحية، الألم واللذة، الخطوات الصغيرة، العدد والرمز.'), ('☀', 'توازن الصباح والمساء', 'دقيقة صباحًا لتحديد أهم 3، ودقيقة مساءً لتقييم يومك من 10.'), ('🤖', 'مساعد ذكي', 'رسائل تقديم للوظائف من سيرتك، أفكار لخطوات صغيرة، ودردشة مع إيمي.'), ('🧭', 'اختبارات ومسار مهني', '9 اختبارات لمعرفة الذات وخريطة للمسارات المهنية المناسبة لك.'), ('📅', 'تقويم ومهام', 'اسحب الأحداث والمهام كما في Google Calendar، وعادات بسلاسل يومية.')],
        steps_h='كيف يعمل', steps=[('أجب بلمسات بسيطة', 'اسمك فقط يُكتب. الباقي اختيارات. دقيقة واحدة.'), ('احصل على خطتك', 'عجلتك، أول دورة 40 يومًا، أهدافك وخطواتك الصغيرة جاهزة.'), ('دقيقة صباحًا ومساءً', 'خطط ليومك، أغلقه، وشاهد عجلتك تنمو.')],
        price_h='الأسعار', per={'month': 'شهريًا', 'year': 'سنويًا'}, plans={'monthly': ('برو شهري', 'التطبيق كاملًا شهرًا بشهر.'), 'yearly': ('برو سنوي', 'سنة كاملة من الدورات، أوفر بنحو 30٪.'), 'coach': ('مع مدرب', 'التطبيق + جلسة شهرية مباشرة مع ميلاد.')}, omr='ر.ع.', best='الأفضل قيمة',
        book_h='الكتاب مجانًا', book_p='نزّل كتاب «Self-Coaching Blueprint» بصيغة PDF مجانًا (بالإنجليزية).', book_btn='نزّل الكتاب', other=('fa.html', 'فارسی'), foot='© 2026 ميلاد إبراهيمي · مسقط، عُمان'),
    'fa': dict(file='fa.html', title='ME.Coach · کوچ شخصی تو، روزی یک دقیقه', desc='اپ خودکوچینگ بر پایه کتاب Self-Coaching Blueprint: چرخ زندگی، هدف‌های ۴۰ روزه، میکرواکشن‌های روزانه و تعادل صبح و شب.',
        kicker='بر پایه کتاب «Self-Coaching Blueprint» نوشته میلاد ابراهیمی', h1='کوچ شخصی تو، روزی یک دقیقه', lead='چرخ زندگی‌ات را بسنج، مهم‌ترین چیز ۴۰ روز آینده را انتخاب کن و هر هدف را به قدم‌های کوچک روزانه تبدیل کن. تعادل صبح و شب در یک دقیقه و گزارش روشن از پیشرفتت.',
        cta='۷ روز رایگان شروع کن', note='بدون کارت · داده‌ها مال خودت · روی آیفون، اندروید و کامپیوتر', signin='ورود',
        feat_h='هرچه یک کوچ هر روز از تو می‌پرسد', feats=[('🎯', 'چرخ زندگی', '۸۰ سؤال کتاب در ۸ حوزه، با نمره برای هر کلمه کلیدی.'), ('🗓', 'هدف‌های ۴۰ روزه', 'پنج قدم: حوزه، کلمه کلیدی، رنج و لذت، میکرواکشن، تعداد و نماد.'), ('☀', 'تعادل صبح و شب', 'یک دقیقه صبح برای سه کار مهم و یک دقیقه شب برای نمره روز از ۱۰.'), ('🤖', 'دستیار هوشمند', 'نامه درخواست کار از رزومه‌ات، ایده میکرواکشن و گفت‌وگو با امی.'), ('🧭', 'تست‌ها و مسیر شغلی', '۹ تست خودشناسی و نقشه شغل‌های مناسب تو.'), ('📅', 'تقویم و کارها', 'جابه‌جایی رویدادها مثل گوگل کلندر و عادت‌ها با زنجیره روزانه.')],
        steps_h='چطور کار می‌کند', steps=[('با چند ضربه جواب بده', 'فقط اسمت را تایپ می‌کنی. بقیه انتخابی است. یک دقیقه.'), ('برنامه‌ات آماده است', 'چرخ، اولین دوره ۴۰ روزه، هدف‌ها و میکرواکشن‌ها.'), ('یک دقیقه صبح و شب', 'روزت را برنامه‌ریزی کن، ببند و رشد چرخت را ببین.')],
        price_h='قیمت‌ها', per={'month': 'ماهانه', 'year': 'سالانه'}, plans={'monthly': ('پرو ماهانه', 'اپ کامل، ماه به ماه.'), 'yearly': ('پرو سالانه', 'یک سال کامل دوره‌ها، حدود ۳۰٪ ارزان‌تر.'), 'coach': ('با کوچ', 'اپ + یک جلسه ماهانه با میلاد.')}, omr='ریال عمان', best='بهترین ارزش',
        book_h='کتاب رایگان', book_p='کتاب «Self-Coaching Blueprint» را رایگان و PDF دانلود کن (انگلیسی).', book_btn='دانلود کتاب', other=('ar.html', 'العربية'), foot='© ۲۰۲۶ میلاد ابراهیمی · مسقط، عمان'),
}


def build_regional():
    for lang, t in REGIONAL.items():
        go = './?start=1&amp;lang=' + lang
        cards = ''.join('<div class="rg-f"><span>%s</span><b>%s</b><p>%s</p></div>' % (i, e(h), e(d)) for i, h, d in t['feats'])
        steps = ''.join('<li><b>%s</b><span>%s</span></li>' % (e(h), e(d)) for h, d in t['steps'])
        prices = ''
        for k, _n, omr, usd, per, _b, _pts, feat in PLANS:
            name, blurb = t['plans'][k]
            prices += '<div class="rg-p%s">%s<b>%s</b><div class="rg-n">%s <small>%s / %s</small></div><div class="rg-u">≈ $%s</div><p>%s</p><a class="s-btn %s" href="%s">%s</a></div>' % (
                ' best' if feat else '', '<em>%s</em>' % e(t['best']) if feat else '', e(name), omr, e(t['omr']), e(t['per'][per]), usd, e(blurb), 'primary' if feat else 'ghost', go, e(t['cta']))
        h = head(t['title'], t['desc'], t['file']).replace('<html lang="en" dir="ltr">', '<html lang="%s" dir="rtl">' % lang)
        body = ('<body class="s-page rg">\n<header class="s-nav"><div class="s-wrap s-nav-in"><a class="s-brand" href="./">ME<b>.</b>Coach</a><span class="s-sp"></span>'
                '<a class="s-lang" href="./" lang="en">English</a><a class="s-lang" href="%s">%s</a><a class="s-btn ghost" href="./?signin=1&amp;lang=%s">%s</a></div></header>\n' % (t['other'][0], t['other'][1], lang, e(t['signin']))
                + '<main><section class="rg-hero"><div class="s-wrap"><span class="kicker">%s</span><h1>%s</h1><p class="rg-lead">%s</p><a class="s-btn primary big" href="%s">%s</a><p class="small">%s</p></div></section>\n' % (e(t['kicker']), e(t['h1']), e(t['lead']), go, e(t['cta']), e(t['note']))
                + '<section class="s-sec"><div class="s-wrap"><h2>%s</h2><div class="rg-grid">%s</div></div></section>\n' % (e(t['feat_h']), cards)
                + '<section class="s-sec alt"><div class="s-wrap"><h2>%s</h2><ol class="rg-steps">%s</ol></div></section>\n' % (e(t['steps_h']), steps)
                + '<section class="s-sec"><div class="s-wrap"><h2>%s</h2><div class="rg-prices">%s</div></div></section>\n' % (e(t['price_h']), prices)
                + '<section class="s-sec alt"><div class="s-wrap rg-book"><img src="assets/img/book-3d.png" alt="Self-Coaching Blueprint" loading="lazy"><div><h2>%s</h2><p>%s</p><a class="s-btn primary" href="api.php?action=book">%s</a></div></div></section></main>\n' % (e(t['book_h']), e(t['book_p']), e(t['book_btn']))
                + '<footer class="s-foot"><div class="s-wrap s-copy">%s · <a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a></div></footer>\n</body>\n</html>\n' % e(t['foot']))
        (ROOT / t['file']).write_text(h + body, encoding='utf-8')


def build_sitemap():
    pages = ['', 'features.html', 'pricing.html', 'book.html', 'faq.html', 'privacy.html', 'terms.html', 'ar.html', 'fa.html']
    (ROOT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ''.join(f'<url><loc>{BASE}{p}</loc></url>' for p in pages) + '</urlset>\n', encoding='utf-8')


if __name__ == '__main__':
    build_index(); build_features(); build_pricing(); build_book(); build_faq(); build_legal(); build_regional(); build_sitemap()
    print('built', ROOT)
