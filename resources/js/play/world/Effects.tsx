import { Bloom, EffectComposer, HueSaturation, Vignette } from '@react-three/postprocessing';

/** Post-processing for high quality: soft glow on pins and lamps, livelier colour, darker corners. Its own chunk so low quality never downloads it. */
export default function Effects() {
    return (
        <EffectComposer multisampling={4}>
            <Bloom mipmapBlur intensity={0.55} luminanceThreshold={0.92} luminanceSmoothing={0.15} />
            <HueSaturation saturation={0.12} />
            <Vignette offset={0.28} darkness={0.42} />
        </EffectComposer>
    );
}
