import { useEffect, useRef, useState } from 'react';
import { GALLERY, GALLERY_SOURCE, galleryImage, type GalleryCategory } from '../data/gallery';
import { useStore } from '../store/useStore';
import { Icon } from './Icon';

export function ProjectGallery() {
  const [category, setCategory] = useState<GalleryCategory>(() => useStore.getState().mode === 'interior' ? 'interiors' : 'architecture');
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const selectedThumb = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const photos = GALLERY.filter(p => p.category === category);
  const photo = photos[index % photos.length];
  const move = (direction: number) => setIndex(i => (i + direction + photos.length) % photos.length);
  const choose = (next: GalleryCategory) => { setCategory(next); setIndex(0); };
  useEffect(() => { setFailed(false); setLoaded(false); selectedThumb.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); }, [photo.id]);
  useEffect(() => {
    const next = new Image(); next.src = galleryImage(photos[(index + 1) % photos.length].file);
  }, [category, index]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches('input,textarea,select')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [photos.length]);
  const explore = (layouts = false) => {
    const state = useStore.getState();
    if (layouts) state.setMode('floors');
    state.set({ presentation: 'interactive', ready: false });
  };
  return (
    <main className="project-gallery">
      <header className="gallery-header">
        <a className="gallery-brand" href={GALLERY_SOURCE} target="_blank" rel="noreferrer"><span>AMIRO <i>×</i> GENURISE</span><strong>NORTH PARK</strong></a>
        <nav className="gallery-tabs" aria-label="Gallery categories"><button className={category === 'architecture' ? 'selected' : ''} onClick={() => choose('architecture')} aria-pressed={category === 'architecture'}>Architecture</button><button className={category === 'interiors' ? 'selected' : ''} onClick={() => choose('interiors')} aria-pressed={category === 'interiors'}>Interiors</button></nav>
        <button className="gallery-explore" onClick={() => explore()}><Icon name="cube" size={17} /><span>Interactive 3D</span><span aria-hidden>↗</span></button>
      </header>
      <section className="gallery-stage" aria-roledescription="carousel" aria-label={`${category} gallery`}>
        <div className="gallery-image-area" onPointerDown={e => { if (e.pointerType === 'touch') touch.current = { x: e.clientX, y: e.clientY }; }} onPointerUp={e => { const start = touch.current; touch.current = null; if (start && Math.abs(e.clientX - start.x) > 55 && Math.abs(e.clientY - start.y) < 65) move(e.clientX < start.x ? 1 : -1); }}>
          <img key={photo.id} className={loaded ? 'gallery-main-image loaded' : 'gallery-main-image'} src={galleryImage(photo.file)} alt={photo.alt} fetchPriority="high" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
          {failed && <div className="gallery-image-error" role="status">This image could not be loaded.<button onClick={() => move(1)}>View the next image</button><a href={GALLERY_SOURCE} target="_blank" rel="noreferrer">Open the developer’s gallery ↗</a></div>}
          <span className="gallery-image-type">DEVELOPER VISUALISATION</span>
          <button className="gallery-expand" onClick={() => dialog.current?.showModal()} aria-label={`Expand ${photo.label}`} title="View full image">⛶</button>
          <button className="gallery-arrow previous" onClick={() => move(-1)} aria-label="Previous image">‹</button><button className="gallery-arrow next" onClick={() => move(1)} aria-label="Next image">›</button>
        </div>
        <div className="gallery-story" aria-live="polite" aria-atomic="true">
          <div className="gallery-story-top"><span>KIADB AEROSPACE PARK · NORTH BENGALURU</span><span>{String(index + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}</span></div>
          <div className="gallery-story-main"><div><span className="gallery-overline">{photo.label}</span><h1>{photo.title}</h1><p>{photo.description}</p></div><button className="gallery-homes" onClick={() => explore(true)}>Explore home layouts <span>↗</span></button></div>
        </div>
      </section>
      <footer className="gallery-footer">
        <div className="gallery-thumbnails" aria-label="Choose an image">{photos.map((p, i) => <button key={p.id} ref={i === index ? selectedThumb : undefined} onClick={() => setIndex(i)} className={index === i ? 'selected' : ''} aria-label={`View ${p.label}`} aria-current={index === i ? 'true' : undefined}><img src={galleryImage(p.file)} alt="" loading="lazy" /><span>{p.label}</span></button>)}</div>
        <div className="gallery-credit"><span>Original project imagery by <a href={GALLERY_SOURCE} target="_blank" rel="noreferrer">Genurise Builders ↗</a></span><span>Illustrative designs & furnishings. Images are not a 360° capture or a specific flat’s verified condition.</span></div>
      </footer>
      <dialog ref={dialog} className="gallery-lightbox" aria-label={photo.label} onClick={e => { if (e.target === dialog.current) dialog.current.close(); }}>
        <button className="gallery-lightbox-close" onClick={() => dialog.current?.close()} aria-label="Close full image">×</button>
        <img src={galleryImage(photo.file)} alt={photo.alt} /><div className="gallery-lightbox-caption"><button onClick={() => move(-1)} aria-label="Previous full image">‹</button><span>{photo.label}</span><button onClick={() => move(1)} aria-label="Next full image">›</button></div>
      </dialog>
    </main>
  );
}
