from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app.slots import OpenInterval, Window, compute_free_starts, local_minute_to_utc

JAKARTA = ZoneInfo("Asia/Jakarta")
NEW_YORK = ZoneInfo("America/New_York")
UTC = timezone.utc

MONDAY = date(2026, 11, 2)  # a Monday
LONG_AGO = datetime(2020, 1, 1, tzinfo=UTC)

SPLIT_DAY = [
    OpenInterval(0, 540, 720),   # 09:00-12:00
    OpenInterval(0, 780, 1020),  # 13:00-17:00
]


def jkt(hour: int, minute: int = 0, day: date = MONDAY) -> datetime:
    """Aware datetime in Jakarta, for readable test data."""
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=JAKARTA)


def hhmm(starts: list[datetime], tz: ZoneInfo = JAKARTA) -> list[str]:
    return [s.astimezone(tz).strftime("%H:%M") for s in starts]


def run(hours=SPLIT_DAY, duration=60, blocked=(), now=LONG_AGO, day=MONDAY, tz=JAKARTA):
    return compute_free_starts(
        day=day, tz=tz, hours=hours, duration_minutes=duration,
        blocked=list(blocked), now=now,
    )


def test_split_hours_skip_lunch_break():
    starts = hhmm(run())
    assert starts[:5] == ["09:00", "09:30", "10:00", "10:30", "11:00"]
    assert "11:30" not in starts      # 60 min would run into lunch
    assert "12:00" not in starts and "12:30" not in starts
    assert starts[5] == "13:00"
    assert starts[-1] == "16:00"      # 16:00-17:00 fits, 16:30 would run past closing
    assert len(starts) == 12


def test_slot_cannot_run_past_closing():
    starts = hhmm(run(duration=120))
    assert starts[-1] == "15:00"      # 15:00-17:00 fits exactly
    assert "15:30" not in starts


def test_service_longer_than_any_interval_gives_nothing():
    assert run(duration=300) == []    # longest interval is 4h (13:00-17:00)


def test_exact_fit_is_allowed():
    assert hhmm(run(duration=240)) == ["13:00"]


def test_other_weekday_has_no_slots():
    tuesday = date(2026, 11, 3)
    assert run(day=tuesday) == []


def test_back_to_back_booking_does_not_block_adjacent_slots():
    booking = Window(jkt(10).astimezone(UTC), jkt(11).astimezone(UTC))  # 10:00-11:00
    starts = hhmm(run(blocked=[booking]))
    assert "09:00" in starts          # 09:00-10:00 ends exactly when the booking starts
    assert "09:30" not in starts      # overlaps 10:00-10:30
    assert "10:00" not in starts
    assert "10:30" not in starts
    assert "11:00" in starts          # starts exactly when the booking ends


def test_cancelled_booking_frees_slot():
    # The caller only passes ACTIVE appointments as blocked; a cancelled one is absent.
    booking = Window(jkt(10).astimezone(UTC), jkt(11).astimezone(UTC))
    assert "10:00" not in hhmm(run(blocked=[booking]))
    assert "10:00" in hhmm(run(blocked=[]))


def test_unavailable_period_blocks_slots():
    closed = Window(jkt(13).astimezone(UTC), jkt(15).astimezone(UTC))
    starts = hhmm(run(blocked=[closed]))
    assert "13:00" not in starts and "14:00" not in starts and "14:30" not in starts
    assert "12:30" not in starts      # outside hours anyway
    assert "15:00" in starts


def test_unavailable_period_spanning_midnight_blocks_next_morning():
    closed = Window(jkt(0, 0, date(2026, 11, 1)).astimezone(UTC), jkt(10).astimezone(UTC))
    starts = hhmm(run(blocked=[closed]))
    assert starts[0] == "10:00"


def test_past_slots_are_excluded():
    now = jkt(10, 15).astimezone(UTC)
    starts = hhmm(run(now=now))
    assert starts[0] == "10:30"       # 10:00 already started
    assert "10:00" not in starts


def test_slot_starting_exactly_now_is_excluded():
    now = jkt(10).astimezone(UTC)
    assert "10:00" not in hhmm(run(now=now))
    assert "10:30" in hhmm(run(now=now))


def test_whole_day_in_past_gives_nothing():
    now = jkt(23, 0, MONDAY).astimezone(UTC)
    assert run(now=now) == []


def test_results_are_utc_aware_and_sorted():
    starts = run()
    assert all(s.tzinfo is not None and s.utcoffset() == timedelta(0) for s in starts)
    assert starts == sorted(starts)
    assert starts[0] == datetime(2026, 11, 2, 2, 0, tzinfo=UTC)  # 09:00 Jakarta = 02:00 UTC


def test_utc_date_differs_from_local_date():
    # 07:00 Jakarta on Monday is 00:00 UTC Monday; 06:30 Jakarta on Monday is Sunday in UTC.
    early = [OpenInterval(0, 390, 480)]  # 06:30-08:00 local
    starts = run(hours=early, duration=30)
    assert hhmm(starts) == ["06:30", "07:00", "07:30"]
    assert starts[0].date() == date(2026, 11, 1)   # Sunday in UTC
    assert starts[0].astimezone(JAKARTA).date() == MONDAY


def test_midnight_closing_1440():
    late = [OpenInterval(0, 1380, 1440)]  # 23:00-24:00
    starts = run(hours=late, duration=30)
    assert hhmm(starts) == ["23:00", "23:30"]


def test_zoneinfo_dst_spring_forward_new_york():
    # US DST starts 2026-03-08. Local 09:00 is EDT (UTC-4) that day, EST (UTC-5) the day before.
    assert local_minute_to_utc(date(2026, 3, 7), 540, NEW_YORK) == datetime(2026, 3, 7, 14, 0, tzinfo=UTC)
    assert local_minute_to_utc(date(2026, 3, 8), 540, NEW_YORK) == datetime(2026, 3, 8, 13, 0, tzinfo=UTC)


def test_zoneinfo_dst_day_slots_follow_wall_clock():
    sunday = date(2026, 3, 8)
    hours = [OpenInterval(6, 540, 600)]  # Sunday 09:00-10:00 local
    starts = compute_free_starts(
        day=sunday, tz=NEW_YORK, hours=hours, duration_minutes=30,
        blocked=[], now=LONG_AGO,
    )
    assert hhmm(starts, NEW_YORK) == ["09:00", "09:30"]
    assert starts[0] == datetime(2026, 3, 8, 13, 0, tzinfo=UTC)


def test_naive_datetime_is_rejected():
    with pytest.raises(ValueError):
        Window(datetime(2026, 11, 2, 9, 0), datetime(2026, 11, 2, 10, 0))
    with pytest.raises(ValueError):
        run(now=datetime(2026, 11, 2, 9, 0))


def test_bad_inputs_are_rejected():
    with pytest.raises(ValueError):
        Window(jkt(10), jkt(10))                  # empty window
    with pytest.raises(ValueError):
        OpenInterval(7, 540, 600)                 # bad weekday
    with pytest.raises(ValueError):
        OpenInterval(0, 600, 540)                 # close before open
    with pytest.raises(ValueError):
        run(duration=45)                          # not a multiple of 30
    with pytest.raises(ValueError):
        run(duration=0)


def test_window_overlap_is_half_open():
    a = Window(jkt(9), jkt(10))
    b = Window(jkt(10), jkt(11))
    c = Window(jkt(9, 30), jkt(10, 30))
    assert not a.overlaps(b) and not b.overlaps(a)
    assert a.overlaps(c) and c.overlaps(a)
    