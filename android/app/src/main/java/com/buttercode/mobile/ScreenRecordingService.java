package com.buttercode.mobile;
import android.app.*;import android.os.*;import android.content.*;import android.content.pm.ServiceInfo;import android.hardware.display.*;import android.media.*;import android.media.projection.*;import android.graphics.Point;import android.view.*;import java.io.*;import java.util.UUID;

/** User-started capture only. START_NOT_STICKY: never record again without new consent. */
public class ScreenRecordingService extends Service {
 public static final String STOP="com.buttercode.mobile.STOP_CAPTURE";public static volatile boolean active=false;public static volatile String activeFileName="";
 private MediaProjection projection;private MediaRecorder recorder;private VirtualDisplay display;private File output;private boolean recording=false,finishing=false;
 @Override public IBinder onBind(Intent intent){return null;}
 @Override public int onStartCommand(Intent intent,int flags,int startId){
  if(intent==null||STOP.equals(intent.getAction())){finish();return START_NOT_STICKY;}if(active)return START_NOT_STICKY;
  boolean mic=intent.getBooleanExtra("microphone",false);String quality=intent.getStringExtra("quality");Intent consent=Build.VERSION.SDK_INT>=33?intent.getParcelableExtra("consent",Intent.class):intent.getParcelableExtra("consent");int result=intent.getIntExtra("result",Activity.RESULT_CANCELED);
  if(consent==null||result!=Activity.RESULT_OK){stopSelf();return START_NOT_STICKY;}
  try{
   NotificationManager nm=getSystemService(NotificationManager.class);nm.createNotificationChannel(new NotificationChannel("recording","Screen recording",NotificationManager.IMPORTANCE_LOW));
   PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,ScreenRecordingService.class).setAction(STOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
   PendingIntent open=PendingIntent.getActivity(this,2,new Intent(this,ScreenNoteActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
   Notification notice=new Notification.Builder(this,"recording").setContentTitle("ScreenNote is recording").setContentText("Tap Stop when you have finished. Local recording: up to 30 minutes / 250 MB.").setSmallIcon(android.R.drawable.presence_video_online).setOngoing(true).setContentIntent(open).addAction(new Notification.Action.Builder(null,"Stop recording",stop).build()).build();
   int types=0;if(Build.VERSION.SDK_INT>=29)types=ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION;if(mic&&Build.VERSION.SDK_INT>=30)types|=ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
   if(Build.VERSION.SDK_INT>=29)startForeground(40,notice,types);else startForeground(40,notice);
   MediaProjectionManager manager=getSystemService(MediaProjectionManager.class);projection=manager.getMediaProjection(result,consent);projection.registerCallback(new MediaProjection.Callback(){@Override public void onStop(){finish();}},new Handler(getMainLooper()));
   File folder=new File(getFilesDir(),"recordings");folder.mkdirs();output=new File(folder,UUID.randomUUID()+".mp4");activeFileName=output.getName();
   Point size=new Point();((WindowManager)getSystemService(WINDOW_SERVICE)).getDefaultDisplay().getRealSize(size);float longest="clear".equals(quality)?1920f:"saver".equals(quality)?960f:1280f;float scale=Math.min(1f,longest/Math.max(size.x,size.y));int width=Math.max(2,Math.round(size.x*scale)/2*2),height=Math.max(2,Math.round(size.y*scale)/2*2);
   recorder=Build.VERSION.SDK_INT>=31?new MediaRecorder(this):new MediaRecorder();if(mic)recorder.setAudioSource(MediaRecorder.AudioSource.MIC);recorder.setVideoSource(MediaRecorder.VideoSource.SURFACE);recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);recorder.setVideoEncoder(MediaRecorder.VideoEncoder.H264);recorder.setVideoSize(width,height);recorder.setVideoFrameRate("saver".equals(quality)?15:24);recorder.setVideoEncodingBitRate("clear".equals(quality)?1600000:"saver".equals(quality)?350000:600000);if(mic){recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);recorder.setAudioEncodingBitRate(64000);recorder.setAudioSamplingRate(44100);}recorder.setOutputFile(output.getAbsolutePath());recorder.setMaxDuration(1800000);recorder.setMaxFileSize(250000000L-65536);recorder.setOnInfoListener((r,what,extra)->{if(what==MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED||what==MediaRecorder.MEDIA_RECORDER_INFO_MAX_FILESIZE_REACHED){getSharedPreferences("capture",MODE_PRIVATE).edit().putString("notice",what==MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED?"Saved: the 30-minute local recording limit was reached.":"Saved: the 250 MB local recording limit was reached.").apply();finish();}});recorder.setOnErrorListener((r,what,extra)->finish());recorder.prepare();
   display=projection.createVirtualDisplay("ScreenNote",width,height,getResources().getDisplayMetrics().densityDpi,DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,recorder.getSurface(),null,null);recorder.start();recording=true;active=true;
  }catch(Exception e){finish();getSharedPreferences("capture",MODE_PRIVATE).edit().putString("error","Recording could not start. Try again with a fresh screen-sharing permission.").apply();}
  return START_NOT_STICKY;
 }
 private synchronized void finish(){if(finishing)return;finishing=true;boolean saved=false;try{if(recording){recorder.stop();saved=output!=null&&output.length()>0;}}catch(RuntimeException ignored){}recording=false;active=false;activeFileName="";if(display!=null){display.release();display=null;}if(recorder!=null){try{recorder.release();}catch(RuntimeException ignored){}recorder=null;}if(projection!=null){MediaProjection p=projection;projection=null;p.stop();}if(output!=null&&!saved)output.delete();if(saved)getSharedPreferences("capture",MODE_PRIVATE).edit().putString("latest",output.getName()).apply();stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();}
 @Override public void onDestroy(){finish();super.onDestroy();}
 @Override public void onTaskRemoved(Intent intent){finish();super.onTaskRemoved(intent);}
}
