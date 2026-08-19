from __future__ import annotations

import json
import re
from pathlib import Path

INPUT = Path('/home/ubuntu/LensiQ/timetable_extracted.txt')
OUTPUT = Path('/home/ubuntu/LensiQ/scripts/timetable_topics.json')

COURSE_NAMES = {
    'Anatomical Pathology': 'Anatomical Pathology',
    'Chemical Pathology': 'Chemical Pathology',
    'Haematology / Immunology': 'Haematology / Immunology',
    'Microbiology': 'Microbiology',
    'Pharmacology': 'Pharmacology',
}

DAY_RE = re.compile(r'^\s*DAY\s+(\d+)\s+—\s+(.+?)\s*$')
TOPIC_RE = re.compile(r'^\s*[•·]\s*\d+\.\s*(.+?)\s*$')


def slugify(value: str) -> str:
    value = value.lower().replace('&', ' and ')
    value = re.sub(r"[^a-z0-9]+", '-', value)
    return value.strip('-')


def main() -> None:
    rows: list[dict[str, object]] = []
    current_day: dict[str, object] | None = None
    current_course: str | None = None
    pending_day_title: str | None = None

    for raw_line in INPUT.read_text(encoding='utf-8').splitlines():
        line = raw_line.replace('\x0c', '').strip()
        if not line:
            continue

        day_match = DAY_RE.match(line)
        if day_match:
            current_day = {
                'day_number': int(day_match.group(1)),
                'day_title': day_match.group(2).strip(),
            }
            pending_day_title = current_day['day_title']
            current_course = None
            continue

        # The first day heading wraps onto a second line in the source PDF.
        if pending_day_title and current_day and line.isupper() and not line.startswith('•'):
            current_day['day_title'] = f"{pending_day_title} {line}".strip()
            pending_day_title = None
            continue

        if line in COURSE_NAMES:
            current_course = COURSE_NAMES[line]
            continue

        topic_match = TOPIC_RE.match(line)
        if not topic_match or not current_day or not current_course:
            continue

        title = re.sub(r'\s+', ' ', topic_match.group(1)).strip()
        rows.append(
            {
                'course_name': current_course,
                'course_slug': slugify(current_course),
                'day_number': current_day['day_number'],
                'day_title': current_day['day_title'],
                'title': title,
                'slug': slugify(title),
                'order_index': sum(
                    1
                    for row in rows
                    if row['course_name'] == current_course
                    and row['day_number'] == current_day['day_number']
                ) + 1,
                'source': 'Year4_7Day_Master_Timetable.pdf',
            }
        )

    if not rows:
        raise SystemExit('No timetable topics were parsed')

    OUTPUT.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'Parsed {len(rows)} timetable topic rows into {OUTPUT}')
    for course in COURSE_NAMES.values():
        count = sum(1 for row in rows if row['course_name'] == course)
        print(f'{course}: {count}')


if __name__ == '__main__':
    main()
