import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fadeIn, staggerContainer, staggerFast } from "@/lib/animations";

interface DressCodeColor {
  hex: string;
  label: string;
}

const DressCodeSection = () => {
  const { data } = useQuery<{ settings: any[] }>({
    queryKey: ["/api/app-settings"],
  });

  const raw = data?.settings.find(s => s.settingKey === "dress_code_colors")?.settingValue ?? "[]";
  let colors: DressCodeColor[] = [];
  try { colors = JSON.parse(raw); } catch { colors = []; }

  if (!data || colors.length === 0) return null;

  return (
    <section
      id="dress-code"
      className="py-20 bg-gradient-to-b from-white via-rose-50/30 to-white paper-texture"
    >
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-12"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerContainer}
        >
          <motion.p
            className="text-sm uppercase font-montserrat tracking-widest text-muted-foreground mb-3"
            variants={fadeIn}
          >
            Attire
          </motion.p>
          <motion.h2
            className="text-5xl md:text-6xl font-cormorant font-bold text-foreground mb-4"
            variants={fadeIn}
          >
            Dress Code
          </motion.h2>
          <motion.div
            className="w-24 h-1 bg-primary mx-auto rounded-full mb-6"
            variants={fadeIn}
          />
          <motion.p
            className="text-muted-foreground font-montserrat max-w-2xl mx-auto"
            variants={fadeIn}
          >
            We kindly ask that guests avoid wearing the following colors to our celebration
          </motion.p>
        </motion.div>

        <motion.div
          className="flex flex-wrap justify-center gap-8 md:gap-12"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerFast}
        >
          {colors.map((color, index) => (
            <motion.div
              key={index}
              className="flex flex-col items-center gap-3"
              variants={fadeIn}
            >
              <div
                className="w-20 h-20 rounded-full border-2 border-primary shadow-md"
                style={{ backgroundColor: color.hex }}
                data-testid={`color-swatch-${index}`}
              />
              <span className="text-xs uppercase font-montserrat tracking-widest text-foreground">
                {color.label}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default DressCodeSection;
