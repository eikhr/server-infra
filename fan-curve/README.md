# AMDGPU fan curve

Fan control for the Navi 10 (RX 5700 XT / 5600 OEM) in eik-desktop. Versioned
here because the running copies live outside any repo (`/usr/local/bin`,
`/etc/systemd/system`) and would not survive a reinstall.

## Install

    sudo install -m 755 fan-curve/amdgpu-fan-curve /usr/local/bin/amdgpu-fan-curve
    sudo install -m 644 fan-curve/amdgpu-fan-curve.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl restart amdgpu-fan-curve.service

## Operations

    systemctl status amdgpu-fan-curve.service
    journalctl -u amdgpu-fan-curve.service -f

Live state, which is the fastest way to see what it is actually doing:

    H=/sys/class/hwmon/hwmon4   # verify: cat $H/name == amdgpu
    cat $H/temp2_input $H/pwm1 $H/pwm1_enable $H/fan1_input

## This card has no zero-RPM stop

Measured, after an attempt to make idle silent by handing low temps back to the
firmware. It made the machine *louder*:

| idle mode at ~40 C junction | pwm1 | fan1_input |
| --- | --- | --- |
| manual, `pwm1_enable=1`, `pwm1=0` | 0 | **701 RPM** |
| firmware auto, `pwm1_enable=2` | 51 (20%) | 1194 RPM |

~701 RPM is the hardware floor and there is no way under it: `pwm1=0` already
asks for less. The card exposes no zero-RPM control either — no
`fan_zero_rpm_enable` anywhere under the PCI device, and no `gpu_od/fan_ctrl`
directory at all on this card and kernel.

So **manual control is held at all times, including idle** — it is the quieter
of the two, by ~490 RPM. A silent idle is simply not on the menu here; it would
need a card whose firmware implements a fan stop.

Note the consequence for the earlier version of this script: its `T < 55 -> PWM 0`
branch was *not* dead code, as was first assumed from seeing the fan turn at
701 RPM while the curve said "off". It was working correctly and already sitting
on the floor.

## Curve

Junction (`temp2_input`) drives it, not edge (`temp1_input`). On Navi 10 junction
runs well above edge under load and is what throttles at 110 C.

| junction | PWM | note |
| --- | --- | --- |
| < 55 C | 0 | idle floor, ~701 RPM |
| 55 C | 40 | curve engages (52 C on the way down — hysteresis) |
| 65 C | 90 | |
| 80 C | 185 | |
| >= 90 C | 255 | |

Continuous between those points. Identical to the original curve from 79 C up;
modestly more aggressive between 55 and 75. Below roughly PWM 36 the fan sits on
its floor regardless, so the bottom of the ramp is a dead zone.

## Two failure modes this guards against

**A GPU reset silently voids the curve.** It restores `pwm1_enable=2` behind the
controller's back, after which every `pwm1` write is ignored by the firmware. The
previous version set the mode once at startup, so this produced no error, no log
line, and a unit still reporting `active (running)` while the curve did nothing.
`pwm1_enable` is now re-asserted on every pass and a mismatch is logged. (This
box has never suspended — no `PM: suspend entry` in any boot in the journal — so
a GPU reset is the realistic trigger, not resume.)

**SIGKILL leaves the fan pinned.** Restoring auto lived only in a `trap ... EXIT`
handler, which does not run on SIGKILL (stop timeout, OOM). A kill during idle
would leave the card in manual mode at PWM 0 on its floor, and a subsequent load
would heat the GPU with the fan there until it throttled. `ExecStopPost=` covers
what the trap cannot, since systemd runs it regardless of how the main process
died. It restores firmware auto: louder at idle, but self-managing, which is the
right resting state for a card nothing is controlling.

## Scope

This controls the GPU fan only. The board's Nuvoton NCT6798D is not driven —
Linux has `asus_wmi_sensors`, which is read-only (7 fan inputs, zero PWM
outputs) — so the CPU and chassis fans run the BIOS Q-Fan curve and cannot be
touched from here. Changing that needs `nct6775` with
`acpi_enforce_resources=lax`, which contests the same chip with ACPI.

## Sensor readings that look alarming but are not

From `sensors` on `asus_wmi_sensors-virtual-0`:

- `Tsensor 1: +216 C` — unpopulated thermistor header.
- `CPU VRM Temperature: +0.0 C`, the second `CPU Core Voltage: 0.00 V` — not
  wired up on this board.
- `Chassis Fan 1/2/3`, `AIO Pump`, `Water Pump`, `CPU OPT`: all 0 RPM — nothing
  plugged into those headers.
- `+12V: 9.97 V` — 17% low while +5V (4.99) and 3VSB (3.31) read true. A rail
  genuinely at 9.97 V would not run this GPU at all, so this is near certainly a
  scaling error in the WMI mapping. **Unverified** — the BIOS hardware monitor
  reads it by a different path; if that also shows ~10 V it is a PSU problem.
