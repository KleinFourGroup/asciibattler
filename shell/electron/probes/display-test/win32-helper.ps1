# The display test's Win32 side (114f): one long-lived process, so
# the P/Invoke types compile once and each request is stamped closely.
# Commands, one per line on stdin; one JSON line back for each:
#   off              ask the display to turn off (SC_MONITORPOWER, 2)
#   on               wake it with a one-pixel mouse move, there and back
#   idle             ms since the session's last input (GetLastInputInfo)
#   events           the display's state changes seen so far (0 off, 1 on, 2 dimmed)
#   beep <name>      warn | clear | start | end | test
#   quit
$ErrorActionPreference = 'Stop'
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

public static class Disp {
  [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, int dx, int dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO info);
  [DllImport("kernel32.dll")] public static extern uint GetTickCount();
  [DllImport("user32.dll")] public static extern IntPtr RegisterPowerSettingNotification(IntPtr recipient, ref Guid setting, int flags);

  public static long Now() { return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(); }
  // One window's default handler turns the display off once. A broadcast
  // reaches every top-level window, and each turns it off again as it gets to
  // the message: with input arriving, the display went off 38 times in 24 s (the desk
  // stretch; that each late window is the cause is inferred, not shown).
  public static IntPtr Hwnd = IntPtr.Zero;
  public static void Off() { PostMessage(Hwnd, 0x0112, (IntPtr)0xF170, (IntPtr)2); }
  public static void OffAll() { PostMessage((IntPtr)0xFFFF, 0x0112, (IntPtr)0xF170, (IntPtr)2); }
  public static void Nudge() { mouse_event(1, 1, 0, 0, UIntPtr.Zero); Thread.Sleep(40); mouse_event(1, -1, 0, 0, UIntPtr.Zero); }
  public static uint IdleMs() {
    LASTINPUTINFO info = new LASTINPUTINFO();
    info.cbSize = (uint)Marshal.SizeOf(info);
    GetLastInputInfo(ref info);
    return GetTickCount() - info.dwTime;
  }
}

// A hidden window that Windows tells about the console display's state.
public class DisplayWatcher : Form {
  static Guid ConsoleDisplayState = new Guid("6fe69556-704a-47a0-8f24-c28d936fda47");
  public static readonly List<string> Seen = new List<string>();
  [StructLayout(LayoutKind.Sequential, Pack = 4)]
  struct POWERBROADCAST_SETTING { public Guid PowerSetting; public uint DataLength; public byte Data; }
  protected override void OnHandleCreated(EventArgs e) {
    base.OnHandleCreated(e);
    Disp.RegisterPowerSettingNotification(Handle, ref ConsoleDisplayState, 0);
    Disp.Hwnd = Handle;
  }
  protected override void SetVisibleCore(bool value) { base.SetVisibleCore(false); }
  protected override void WndProc(ref Message m) {
    if (m.Msg == 0x0218 && (int)m.WParam == 0x8013) {
      POWERBROADCAST_SETTING s = (POWERBROADCAST_SETTING)Marshal.PtrToStructure(m.LParam, typeof(POWERBROADCAST_SETTING));
      if (s.PowerSetting == ConsoleDisplayState) {
        lock (Seen) Seen.Add("{\"epoch\":" + Disp.Now() + ",\"state\":" + s.Data + "}");
      }
    }
    base.WndProc(ref m);
  }
  public static void Start() {
    Thread t = new Thread(() => { DisplayWatcher w = new DisplayWatcher(); IntPtr h = w.Handle; Application.Run(w); });
    t.IsBackground = true;
    t.SetApartmentState(ApartmentState.STA);
    t.Start();
  }
  public static string Dump() { lock (Seen) return "[" + string.Join(",", Seen) + "]"; }
}
'@

[DisplayWatcher]::Start()

$beeps = @{
  warn  = @(@(1047, 150), @(0, 100), @(1047, 150))
  clear = @(, @(392, 450))
  start = @(@(523, 200), @(659, 200), @(784, 350))
  end   = @(@(784, 200), @(659, 200), @(523, 350))
  test  = @(, @(660, 200))
}

function Reply($text) { [Console]::Out.WriteLine($text); [Console]::Out.Flush() }

Reply '{"ready":true}'
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $parts = $line.Trim().Split(' ')
  switch ($parts[0]) {
    'off' {
      $idle = [Disp]::IdleMs(); $before = [Disp]::Now(); [Disp]::Off(); $after = [Disp]::Now()
      Reply ('{"cmd":"off","before":' + $before + ',"after":' + $after + ',"idleMs":' + $idle + '}')
    }
    'off-all' {
      $idle = [Disp]::IdleMs(); $before = [Disp]::Now(); [Disp]::OffAll(); $after = [Disp]::Now()
      Reply ('{"cmd":"off-all","before":' + $before + ',"after":' + $after + ',"idleMs":' + $idle + '}')
    }
    'hwnd' { Reply ('{"cmd":"hwnd","hwnd":' + [Disp]::Hwnd.ToInt64() + '}') }
    'on' {
      $idle = [Disp]::IdleMs(); $before = [Disp]::Now(); [Disp]::Nudge(); $after = [Disp]::Now()
      Reply ('{"cmd":"on","before":' + $before + ',"after":' + $after + ',"idleMs":' + $idle + '}')
    }
    'idle' { Reply ('{"cmd":"idle","epoch":' + [Disp]::Now() + ',"idleMs":' + [Disp]::IdleMs() + '}') }
    'events' { Reply ('{"cmd":"events","events":' + [DisplayWatcher]::Dump() + '}') }
    'beep' {
      $from = [Disp]::Now()
      foreach ($note in $beeps[$parts[1]]) {
        if ($note[0] -eq 0) { Start-Sleep -Milliseconds $note[1] } else { [Console]::Beep($note[0], $note[1]) }
      }
      Reply ('{"cmd":"beep","name":"' + $parts[1] + '","from":' + $from + ',"to":' + [Disp]::Now() + '}')
    }
    'quit' { Reply '{"cmd":"quit"}'; exit 0 }
    default { Reply ('{"error":"unknown command"}') }
  }
}
