#!/usr/bin/env python3

"""Atomically rename one macOS path without replacing an existing target."""

import ctypes
import os
import sys


RENAME_EXCL = 0x00000004
RENAME_NOFOLLOW_ANY = 0x00000010


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("usage: atomic-rename-no-replace.py SOURCE TARGET")
    source = os.fsencode(sys.argv[1])
    target = os.fsencode(sys.argv[2])
    libc = ctypes.CDLL(None, use_errno=True)
    renamex = libc.renamex_np
    renamex.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_uint]
    renamex.restype = ctypes.c_int
    if renamex(source, target, RENAME_EXCL | RENAME_NOFOLLOW_ANY) != 0:
        error_number = ctypes.get_errno()
        raise OSError(error_number, os.strerror(error_number), os.fsdecode(target))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
