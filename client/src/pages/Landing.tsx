import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Zap, Shield, Globe } from "lucide-react";
import { useEffect } from "react";

export default function Landing() {
  
  const features = [
    { icon: Zap, title: "Instant Sharing", desc: "Share your moments instantly with our lightning fast upload." },
    { icon: Shield, title: "Private & Secure", desc: "Your data is encrypted and safe. You own your content." },
    { icon: Globe, title: "Connect Globally", desc: "Find friends and communities from every corner of the world." }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Navbar */}
      <nav className="fixed w-full z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="text-2xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                SocialApp
              </span>
            </div>
            <Button asChild variant="outline" className="rounded-full font-semibold">
              <a href="/api/login">Log In</a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center lg:text-left space-y-8"
            >
              <h1 className="text-5xl lg:text-7xl font-display font-bold leading-tight tracking-tight">
                Connect. Share. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                  Inspire.
                </span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0">
                The next generation social platform built for creators, thinkers, and dreamers. Join the community today.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button size="lg" className="rounded-full text-lg h-14 px-8 bg-primary hover:bg-primary/90" asChild>
                  <a href="/api/login">
                    Get Started <ArrowRight className="ml-2 w-5 h-5" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" className="rounded-full text-lg h-14 px-8">
                  View Demo
                </Button>
              </div>
              
              <div className="flex items-center justify-center lg:justify-start gap-6 text-sm text-muted-foreground pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" /> Free Forever
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" /> No Credit Card
                </div>
              </div>
            </motion.div>

            {/* Right Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 to-accent/30 rounded-3xl blur-3xl -z-10" />
              <img 
                src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80" 
                alt="App Interface" 
                className="rounded-3xl shadow-2xl border border-white/10 w-full hover:scale-[1.02] transition-transform duration-500"
              />
              {/* Unsplash image: Mobile app interface mockup or abstract social concept */}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-display font-bold mb-4">Why choose us?</h2>
            <p className="text-muted-foreground">Everything you need to build your social presence.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="bg-card p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow border"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-6">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-sm text-muted-foreground border-t">
        <p>&copy; 2024 SocialApp. All rights reserved.</p>
      </footer>
    </div>
  );
}
