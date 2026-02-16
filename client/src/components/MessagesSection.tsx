import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, useInView } from 'framer-motion';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Heart, Send } from 'lucide-react';
import { fadeIn, staggerContainer } from '@/lib/animations';

const messageSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  content: z.string().min(3, "Message must be at least 3 characters").max(500, "Message cannot exceed 500 characters")
});

type MessageFormValues = z.infer<typeof messageSchema>;

interface Message {
  id: number;
  name: string;
  email: string;
  content: string;
  createdAt: string;
}

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

const MessagesSection = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const formRef = useRef(null);
  
  const isSectionInView = useInView(sectionRef, { once: true, amount: 0.1 });
  const isTitleInView = useInView(titleRef, { once: true, amount: 0.5 });
  const isFormInView = useInView(formRef, { once: true, amount: 0.3 });
  
  const { toast } = useToast();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<MessageFormValues>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      name: "",
      content: ""
    }
  });

  const { 
    data = { messages: [], count: 0 }, 
    isLoading, 
    isError 
  } = useQuery<{ messages: Message[], count: number }>({ 
    queryKey: ['/api/messages'],
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: MessageFormValues) => {
      const response = await apiRequest("POST", "/api/messages", data);
      return response.json();
    },
    onSuccess: () => {
      setIsSubmitted(true);
      toast({
        title: "Message Sent!",
        description: "Your wishes have been added. Thank you!",
        variant: "default"
      });
      reset();
      setTimeout(() => {
        setIsSubmitted(false);
      }, 3000);
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to submit message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: MessageFormValues) => {
    mutate(data);
  };

  const formatMessageDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return dateString;
    }
  };

  const displayedMessages = showAll ? data.messages : data.messages.slice(0, 3);

  return (
    <section 
      id="messages" 
      className="py-16 md:py-24 bg-gradient-to-b from-background to-primary/5"
      ref={sectionRef}
    >
      <div className="container mx-auto px-4">
        <motion.div
          ref={titleRef}
          initial="hidden"
          animate={isTitleInView ? "visible" : "hidden"}
          variants={staggerContainer}
          className="text-center mb-12"
        >
          <motion.div variants={fadeIn} className="flex items-center justify-center gap-3 mb-4">
            <Heart className="w-5 h-5 text-primary" />
            <span className="text-primary font-montserrat text-sm uppercase tracking-widest">
              Wishes & Blessings
            </span>
            <Heart className="w-5 h-5 text-primary" />
          </motion.div>
          
          <motion.h2 
            variants={fadeIn}
            className="text-4xl md:text-5xl font-cormorant text-foreground mb-4"
          >
            Share Your Wishes
          </motion.h2>
          
          <motion.div 
            variants={fadeIn}
            className="w-24 h-0.5 bg-primary mx-auto mb-4"
          />
          
          <motion.p 
            variants={fadeIn}
            className="text-muted-foreground font-montserrat max-w-xl mx-auto"
          >
            Leave your congratulations and well-wishes for the couple
          </motion.p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <Card className="h-full">
                    <CardContent className="p-5">
                      <div className="flex items-start space-x-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-20 bg-primary/10 rounded"></div>
                          <div className="h-16 w-full bg-muted rounded"></div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="text-center p-6 bg-destructive/10 rounded-lg mb-8">
              <MessageCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
              <p className="text-muted-foreground">Couldn't load messages. Please try again.</p>
            </div>
          ) : displayedMessages.length > 0 ? (
            <motion.div 
              initial="hidden"
              animate={isSectionInView ? "visible" : "hidden"}
              variants={staggerContainer}
              className="mb-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {displayedMessages.map((message) => (
                  <motion.div key={message.id} variants={fadeIn}>
                    <Card className="h-full hover:shadow-md transition-shadow duration-300">
                      <CardContent className="p-5">
                        <div className="flex items-start space-x-3">
                          <Avatar className="h-10 w-10 bg-primary/10 text-primary">
                            <AvatarFallback>{getInitials(message.name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="mb-1">
                              <p className="font-montserrat text-foreground font-medium text-sm">
                                {message.name}
                              </p>
                              <span className="text-muted-foreground text-xs">
                                {formatMessageDate(message.createdAt)}
                              </span>
                            </div>
                            <p className="text-muted-foreground text-sm line-clamp-3">
                              {message.content}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
              
              {data.messages.length > 3 && (
                <div className="text-center">
                  <button
                    onClick={() => setShowAll(!showAll)}
                    className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-montserrat text-sm transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {showAll ? "Show less" : `See all ${data.messages.length} wishes`}
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="text-center p-8 bg-muted/20 rounded-lg mb-8">
              <MessageCircle className="h-12 w-12 text-primary/50 mx-auto mb-3" />
              <p className="text-muted-foreground">Be the first to leave a message!</p>
            </div>
          )}

          <motion.div
            ref={formRef}
            initial="hidden"
            animate={isFormInView ? "visible" : "hidden"}
            variants={fadeIn}
          >
            <Card className="overflow-hidden">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-center gap-2 mb-6">
                  <Send className="w-5 h-5 text-primary" />
                  <h3 className="text-xl font-cormorant text-foreground">Leave Your Wishes</h3>
                </div>
                
                {isSubmitted ? (
                  <div className="text-center py-8">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 10 }}
                    >
                      <Heart className="w-16 h-16 text-primary mx-auto mb-4" />
                    </motion.div>
                    <h4 className="text-2xl font-cormorant text-foreground mb-2">Thank You!</h4>
                    <p className="text-muted-foreground">Your wishes have been sent to the couple.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                      <label className="block text-sm font-montserrat text-foreground mb-1.5">
                        Your Name
                      </label>
                      <input
                        type="text"
                        {...register("name")}
                        className="w-full px-4 py-2.5 border border-input rounded-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="Enter your name"
                      />
                      {errors.name && (
                        <p className="text-destructive text-xs mt-1">{errors.name.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-montserrat text-foreground mb-1.5">
                        Your Message
                      </label>
                      <Textarea
                        {...register("content")}
                        rows={4}
                        className="w-full px-4 py-2.5 border border-input rounded-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                        placeholder="Write your wishes for the couple..."
                      />
                      {errors.content && (
                        <p className="text-destructive text-xs mt-1">{errors.content.message}</p>
                      )}
                    </div>
                    
                    <div className="text-center pt-2">
                      <button
                        type="submit"
                        disabled={isPending}
                        className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-sm font-montserrat text-sm uppercase tracking-wider hover:bg-primary/90 transition-all duration-300 disabled:opacity-50"
                      >
                        {isPending ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Send Wishes
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default MessagesSection;
